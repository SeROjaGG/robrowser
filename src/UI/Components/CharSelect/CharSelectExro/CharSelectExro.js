/**
 * UI/Components/CharSelect/CharSelectExro/CharSelectExro.js
 *
 * eXRo custom character-select screen (PLAN-009).
 *
 * Standalone GUIComponent — implements the CharEngine API directly, does NOT
 * go through createCharSelect(). CharSelectCommon.js is untouched. Registered
 * at PACKETVER 20251001 in ../CharSelect.js.
 *
 * ── Engine contract (verified against src/Engine/CharEngine.js 2026-09-09) ──
 *   render()                 -> HTML string
 *   init()                   -> wire static DOM events (once, in prepare())
 *   onAppend() / onRemove()  -> start / stop the sprite render loop
 *   onKeyDown(event)         -> LEFT/RIGHT select, ENTER connect, ESC back, SUPR delete
 *   setInfo(pkt)             -> pkt.TotalSlotNum, pkt.PremiumStartSlot, pkt.sex, pkt.charInfo[]
 *   addCharacter(charInfo)   -> one parseCharList() slot (after create / list chunk)
 *   deleteAnswer(error)      -> error in -2,-1,0..7
 *   reqdeleteAnswer(pkt)     -> pkt.Result (0,1,3,4,5), pkt.DeleteReservedDate
 *   setUIEnabled(bool)       -> .busy lock during a server round-trip
 *   renameAnswer(err)        -> PLAN-009 section C (rename validity refused)
 *   updateCharName(slot,new) -> PLAN-009 section C (rename applied)
 *   callbacks set by engine:  onExitRequest, onConnectRequest, onCreateRequest,
 *                             onDeleteRequest, onDeleteReqDelay, onCancelDeleteRequest
 *   callback added by PLAN-009: onRenameRequest(slot, newName)
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */

import DB from 'DB/DBManager.js';
import MonsterTable from 'DB/Monsters/MonsterTable.js';
import Preferences from 'Core/Preferences.js';
import KEYS from 'Controls/KeyEventHandler.js';
import Renderer from 'Renderer/Renderer.js';
import Network from 'Network/NetworkManager.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import InputBox from 'UI/Components/InputBox/InputBox.js';
import 'UI/Elements/Elements.js';
import { makeCharEntity, drawCharEntity } from '../charSprite.js';
import htmlText from './CharSelectExro.html?raw';
import cssText from './CharSelectExro.css?raw';

/** canvas intrinsic size + sprite anchor (px). Canvases are kept small (native
 * RO sprite scale) and enlarged with a CSS transform on .card/.slot. */
const CARD_W = 180;
const CARD_H = 240;
const CARD_ANCHOR = { x: 90, y: 232 };
// A small canvas culls the sprite render, so keep the canvas roughly card-sized
// and shrink it with CSS instead. Feet ~92 in a 110-tall canvas → whole body,
// head included; CSS scales the whole thing down into the rail row.
const PORTRAIT_W = 88;
const PORTRAIT_H = 110;
const PORTRAIT_ANCHOR = { x: 44, y: 106 };

const Component = new GUIComponent('CharSelectExro', cssText);

Component.render = () => htmlText;

const _prefs = Preferences.get('CharSelectExro', { index: 0 }, 1.0);

let _list = []; // characters, in the order the carousel/rail show them
let _index = 0; // active entry in _list
let _maxSlots = 15;
let _accountSex = 0;
let _disabled = false;
let _loopFn = null;
let _timerInterval = null;
const _entities = {}; // CharNum -> Entity
const _cardCtx = []; // { ctx, entity } parallel to _list
const _railCtx = []; // { ctx, entity } parallel to _list

/* ── helpers ─────────────────────────────────────────────── */

function jobName(job) {
	return MonsterTable[job] || '';
}

function firstFreeSlot() {
	const used = new Set(_list.map(c => c.CharNum));
	for (let i = 0; i < _maxSlots; i++) {
		if (!used.has(i)) {
			return i;
		}
	}
	return 0;
}

function ingestDeleteDate(character) {
	// our PACKETVER (20251001 >= 20150513) sends remaining seconds — make absolute
	if (character.DeleteDate) {
		character.deleteAt = Math.floor(Date.now() / 1000) + character.DeleteDate;
	}
}

/* ── DOM build ───────────────────────────────────────────── */

function rebuild() {
	const root = Component.getRoot();
	const cards = root.querySelector('.cs-cards');
	const dots = root.querySelector('.cs-dots');
	const slots = root.querySelector('.cs-slots');

	cards.textContent = '';
	dots.textContent = '';
	slots.textContent = '';
	_cardCtx.length = 0;
	_railCtx.length = 0;

	root.querySelector('.cs-carousel').classList.toggle('empty', _list.length === 0);

	_list.forEach((char, i) => {
		if (!_entities[char.CharNum]) {
			_entities[char.CharNum] = makeCharEntity(char, _accountSex);
		}
		const entity = _entities[char.CharNum];
		const reserved = !!char.deleteAt;

		// carousel card
		const card = document.createElement('div');
		card.className = 'card' + (reserved ? ' reserved' : '');
		card.dataset.index = String(i);
		const shot = document.createElement('canvas');
		shot.className = 'shot';
		shot.width = CARD_W;
		shot.height = CARD_H;
		const nm = document.createElement('div');
		nm.className = 'nm';
		nm.textContent = char.name;
		const jb = document.createElement('div');
		jb.className = 'jb';
		jb.textContent = `${jobName(char.job)} · Lv ${char.level}`;
		card.append(shot, nm, jb);
		if (reserved) {
			const t = document.createElement('div');
			t.className = 'timer';
			card.appendChild(t);
		}
		cards.appendChild(card);
		_cardCtx.push({ ctx: shot.getContext('2d'), entity });

		// dot
		const dot = document.createElement('span');
		dot.dataset.index = String(i);
		dots.appendChild(dot);

		// rail slot
		const slot = document.createElement('div');
		slot.className = 'slot' + (reserved ? ' reserved' : '');
		slot.dataset.index = String(i);
		const por = document.createElement('canvas');
		por.className = 'por';
		por.width = PORTRAIT_W;
		por.height = PORTRAIT_H;
		const txt = document.createElement('div');
		txt.className = 'txt';
		txt.innerHTML = `<div class="nm"></div><div class="jb"></div>`;
		txt.querySelector('.nm').textContent = char.name;
		txt.querySelector('.jb').textContent = `${jobName(char.job)} · Lv ${char.level}`;
		slot.append(por, txt);
		slots.appendChild(slot);
		_railCtx.push({ ctx: por.getContext('2d'), entity });
	});

	root.querySelector('.cs-count .used').textContent = String(_list.length);
	root.querySelector('.cs-count .max').textContent = String(_maxSlots);
	root.querySelector('.cs-new').disabled = _list.length >= _maxSlots;

	select(_index);
}

/* ── selection ───────────────────────────────────────────── */

function select(i) {
	const root = Component.getRoot();
	_index = _list.length ? Math.max(0, Math.min(i, _list.length - 1)) : 0;
	const char = _list[_index];

	root.querySelectorAll('.card').forEach(el => el.classList.toggle('on', +el.dataset.index === _index));
	root.querySelectorAll('.cs-dots span').forEach(el => el.classList.toggle('on', +el.dataset.index === _index));
	root.querySelectorAll('.slot').forEach(el => el.classList.toggle('on', +el.dataset.index === _index));

	centreCarousel();

	root.querySelector('.cs-nav.prev').disabled = _index <= 0;
	root.querySelector('.cs-nav.next').disabled = _index >= _list.length - 1;

	const stats = root.querySelector('.cs-stats');
	const enter = root.querySelector('.btn.enter');
	if (!char) {
		stats.hidden = true;
		enter.hidden = true;
		return;
	}
	stats.hidden = false;
	enter.hidden = false;

	root.querySelector('.cs-name').textContent = char.name;
	root.querySelector('.cs-sub').textContent = `${jobName(char.job)} · Base Lv ${char.level}`;

	const hpPct = char.maxhp ? Math.max(0, Math.min(100, (char.hp / char.maxhp) * 100)) : 0;
	const spPct = char.maxsp ? Math.max(0, Math.min(100, (char.sp / char.maxsp) * 100)) : 0;
	root.querySelector('.bar.hp i').style.width = `${hpPct}%`;
	root.querySelector('.bar.sp i').style.width = `${spPct}%`;
	root.querySelector('.hpv').textContent = `${char.hp} / ${char.maxhp}`;
	root.querySelector('.spv').textContent = `${char.sp} / ${char.maxsp}`;

	root.querySelector('.v-map').textContent = DB.getMapName(char.lastMap, '') || char.lastMap || '';
	root.querySelector('.v-job').textContent = jobName(char.job);
	root.querySelector('.v-base').textContent = char.level;
	root.querySelector('.v-joblv').textContent = char.joblevel;
	root.querySelector('.v-exp').textContent = char.exp;
	root.querySelector('.v-zeny').textContent = char.money;
	root.querySelector('.a-str').textContent = char.Str;
	root.querySelector('.a-int').textContent = char.Int;
	root.querySelector('.a-agi').textContent = char.Agi;
	root.querySelector('.a-dex').textContent = char.Dex;
	root.querySelector('.a-vit').textContent = char.Vit;
	root.querySelector('.a-luk').textContent = char.Luk;

	syncToolRow(char);
	_prefs.index = _index;
}

// Only the active card is shown (CSS `.card { display: none }` / `.card.on`),
// centred by the strip's own `justify-content: center` — nothing to translate.
function centreCarousel() {
	const strip = Component.getRoot().querySelector('.cs-cards');
	if (strip) {
		strip.style.transform = '';
	}
}

function syncToolRow(char) {
	const root = Component.getRoot();
	const reserved = !!char.deleteAt;
	root.querySelector('.tool.rename').hidden = reserved;
	root.querySelector('.tool.rename').disabled = !!char.bIsChangedCharName;
	root.querySelector('.tool.delete').hidden = reserved;
	root.querySelector('.tool.canceldelete').hidden = !reserved;
	root.querySelector('.tool.finaldelete').hidden = !reserved || Math.floor(Date.now() / 1000) < char.deleteAt;
}

/* ── delete-reservation countdown ────────────────────────── */

function fmtRemaining(sec) {
	if (sec <= 0) {
		return 'ready to delete';
	}
	const h = Math.floor(sec / 3600);
	const m = Math.floor((sec % 3600) / 60);
	const s = sec % 60;
	return `${h}h ${m}m ${s}s`;
}

function tickTimers() {
	const root = Component.getRoot();
	const now = Math.floor(Date.now() / 1000);
	root.querySelectorAll('.card').forEach(card => {
		const char = _list[+card.dataset.index];
		const t = card.querySelector('.timer');
		if (char && char.deleteAt && t) {
			t.textContent = fmtRemaining(char.deleteAt - now);
		}
	});
	const cur = _list[_index];
	if (cur && cur.deleteAt) {
		syncToolRow(cur);
	}
}

/* ── sprite loop ─────────────────────────────────────────── */

function renderLoop() {
	for (let i = 0; i < _cardCtx.length; i++) {
		drawCharEntity(_cardCtx[i].ctx, _cardCtx[i].entity, CARD_ANCHOR.x, CARD_ANCHOR.y);
	}
	for (let i = 0; i < _railCtx.length; i++) {
		drawCharEntity(_railCtx[i].ctx, _railCtx[i].entity, PORTRAIT_ANCHOR.x, PORTRAIT_ANCHOR.y);
	}
}

/* ── actions ─────────────────────────────────────────────── */

function connect() {
	if (_disabled) {
		return;
	}
	const char = _list[_index];
	if (char && !char.deleteAt) {
		_prefs.index = _index;
		_prefs.save();
		Component.onConnectRequest(char);
	}
}

// Leave the game client entirely and return to the eXRo site. This intentionally
// diverges from the PLAN-008 char-select behaviour (which reloaded /play): the
// only bottom action now is "Enter World", and leaving goes to the account page.
function back() {
	if (_disabled) {
		return;
	}
	if (typeof window !== 'undefined' && window.location) {
		// close the char-server socket so rAthena drops the online-user entry now,
		// rather than on socket timeout — otherwise the next /play load races the
		// stale session and gets an "already online" refusal.
		try {
			Network.close();
		} catch {
			/* not connected */
		}
		window.onbeforeunload = null; // drop roBrowser's "exit?" guard (App/Online.js)
		window.location.assign('/account');
	} else {
		Component.onExitRequest();
	}
}

function createChar() {
	if (!_disabled && _list.length < _maxSlots) {
		Component.onCreateRequest(firstFreeSlot());
	}
}

function reserveDelete() {
	if (_disabled) {
		return;
	}
	const char = _list[_index];
	if (char && !char.deleteAt) {
		Component.off('keydown');
		Component.onDeleteReqDelay(char.GID);
	}
}

function cancelDelete() {
	if (_disabled) {
		return;
	}
	const char = _list[_index];
	if (char && char.deleteAt) {
		// optimistic, like CharSelectCommon.removedelete(): clear locally, then tell
		// the server. rAthena sends no distinct cancel-ack this flow listens for.
		delete char.deleteAt;
		Component.onCancelDeleteRequest(char.GID);
		rebuild();
	}
}

function finalDelete() {
	if (_disabled) {
		return;
	}
	const char = _list[_index];
	if (char && char.deleteAt && Math.floor(Date.now() / 1000) >= char.deleteAt) {
		Component.off('keydown');
		Component.onDeleteRequest(char.GID);
	}
}

function renameChar() {
	if (_disabled) {
		return;
	}
	const char = _list[_index];
	if (!char || char.bIsChangedCharName || char.deleteAt) {
		return;
	}

	// The stock InputBox modal's click-blocking overlay sits BELOW this full-screen
	// component (z-index), so clicks that miss the InputBox fall through to the
	// carousel (a stray double-click there = Enter World). Lock ourselves while it's
	// open; unlock when it closes (submit OR overlay-click/cancel — GUIComponent
	// fires x_remove on remove()).
	Component.setUIEnabled(false);
	InputBox.append();
	InputBox.setType('text', false, char.name);
	if (InputBox._host) {
		InputBox._host.addEventListener('x_remove', () => Component.setUIEnabled(true), { once: true });
	}
	InputBox.onSubmitRequest = function (name) {
		InputBox.remove();
		const trimmed = (name || '').trim();
		if (!trimmed || trimmed === char.name) {
			return;
		}
		Component.onRenameRequest(char, trimmed);
	};
}

/* ── engine contract ─────────────────────────────────────── */

Component.init = function init() {
	const root = this.getRoot();
	root.querySelector('.cs-nav.prev').addEventListener('click', () => !_disabled && select(_index - 1));
	root.querySelector('.cs-nav.next').addEventListener('click', () => !_disabled && select(_index + 1));
	root.querySelector('.cs-new').addEventListener('click', createChar);
	root.querySelector('.btn.enter').addEventListener('click', connect);
	root.querySelector('.cs-back').addEventListener('click', back);
	root.querySelector('.tool.rename').addEventListener('click', renameChar);
	root.querySelector('.tool.delete').addEventListener('click', reserveDelete);
	root.querySelector('.tool.canceldelete').addEventListener('click', cancelDelete);
	root.querySelector('.tool.finaldelete').addEventListener('click', finalDelete);

	root.querySelector('.cs-cards').addEventListener('click', e => {
		const card = e.target.closest('.card');
		if (card && !_disabled) {
			select(+card.dataset.index);
		}
	});
	root.querySelector('.cs-cards').addEventListener('dblclick', e => {
		if (e.target.closest('.card') && !_disabled) {
			connect();
		}
	});
	root.querySelector('.cs-dots').addEventListener('click', e => {
		if (e.target.dataset.index !== undefined && !_disabled) {
			select(+e.target.dataset.index);
		}
	});
	root.querySelector('.cs-slots').addEventListener('click', e => {
		const slot = e.target.closest('.slot');
		if (slot && !_disabled) {
			select(+slot.dataset.index);
		}
	});
};

Component.onKeyDown = function onKeyDown(event) {
	if (this._host.style.display === 'none') {
		return true;
	}
	switch (event.which) {
		case KEYS.LEFT:
			select(_index - 1);
			break;
		case KEYS.RIGHT:
			select(_index + 1);
			break;
		case KEYS.ENTER:
			connect();
			break;
		case KEYS.ESCAPE:
			back();
			break;
		case KEYS.SUPR:
			if (_list[_index] && !_list[_index].deleteAt) {
				reserveDelete();
			}
			break;
		default:
			return true;
	}
	event.stopImmediatePropagation();
	return false;
};

Component.onAppend = function onAppend() {
	this._host.style.position = 'fixed';
	this._host.style.inset = '0';
	this._host.style.width = '100%';
	this._host.style.height = '100%';

	_index = _prefs.index || 0;
	rebuild();

	_loopFn = renderLoop;
	Renderer.render(_loopFn);
	_timerInterval = setInterval(tickTimers, 1000);
};

Component.onRemove = function onRemove() {
	if (_loopFn) {
		Renderer.stop(_loopFn);
		_loopFn = null;
	}
	if (_timerInterval) {
		clearInterval(_timerInterval);
		_timerInterval = null;
	}
	_prefs.index = _index;
	_prefs.save();
};

Component.setInfo = function setInfo(pkt) {
	// TotalSlotNum is the real cap (rAthena MAX_CHARS); PremiumStartSlot is only the
	// index where premium slots begin, not extra slots — don't add it.
	_maxSlots = Math.floor(pkt.TotalSlotNum) || 15;
	_accountSex = pkt.sex;
	_list = [];
	for (const key in _entities) {
		delete _entities[key];
	}

	if (pkt.charInfo) {
		pkt.charInfo.forEach(c => {
			ingestDeleteDate(c);
			_list.push(c);
		});
	}
	_list.sort((a, b) => a.CharNum - b.CharNum);

	if (this._host && this._host.parentNode) {
		rebuild();
	}
};

Component.addCharacter = function addCharacter(charInfo) {
	if (!('sex' in charInfo) || charInfo.sex === 99) {
		charInfo.sex = _accountSex;
	}
	ingestDeleteDate(charInfo);
	if (!_list.some(c => c.CharNum === charInfo.CharNum)) {
		_list.push(charInfo);
		_list.sort((a, b) => a.CharNum - b.CharNum);
		_index = _list.findIndex(c => c.CharNum === charInfo.CharNum);
	}
	if (this._host && this._host.parentNode) {
		rebuild();
	}
};

Component.deleteAnswer = function deleteAnswer(error) {
	this.on('keydown');
	switch (error) {
		case -1:
		case -2:
			return;
		case 1: {
			const char = _list[_index];
			if (char) {
				delete _entities[char.CharNum];
				_list.splice(_index, 1);
				_index = Math.max(0, Math.min(_index, _list.length - 1));
			}
			rebuild();
			return;
		}
		case 3:
			UIManager.showMessageBox(DB.getMessage(1817), 'ok');
			return;
		case 4:
			UIManager.showMessageBox(DB.getMessage(1820), 'ok');
			return;
		case 5:
			UIManager.showMessageBox(DB.getMessage(1822), 'ok');
			return;
		case 7:
			UIManager.showMessageBox(DB.getMessage(301), 'ok');
			return;
		default:
			UIManager.showMessageBox(DB.getMessage(1821), 'ok');
			return;
	}
};

Component.reqdeleteAnswer = function reqdeleteAnswer(pkt) {
	this.on('keydown');
	const result = typeof pkt.Result === 'undefined' ? -1 : pkt.Result;
	const char = _list[_index];
	switch (result) {
		case 1:
			if (char) {
				char.deleteAt = Math.floor(Date.now() / 1000) + pkt.DeleteReservedDate;
			}
			rebuild();
			return;
		case 4:
			UIManager.showMessageBox(DB.getMessage(1818), 'ok');
			return;
		case 5:
			UIManager.showMessageBox(DB.getMessage(1819), 'ok');
			return;
		default:
			return;
	}
};

Component.setUIEnabled = function setUIEnabled(value) {
	_disabled = !value;
	const root = this.getRoot();
	if (root && root.querySelector) {
		root.querySelector('.cs').classList.toggle('busy', _disabled);
	}
};

/* PLAN-009 section C — rename result hooks (called from CharEngine.js) */

Component.renameAnswer = function renameAnswer(reason) {
	UIManager.showMessageBox(reason || DB.getMessage(1900) || 'That name cannot be used.', 'ok');
};

Component.updateCharName = function updateCharName(char, newName) {
	const target = _list.find(c => c.GID === char.GID);
	if (target) {
		target.name = newName;
		target.bIsChangedCharName = 1;
	}
	rebuild();
};

/* callbacks set by the engine (defaults) */
Component.onExitRequest = function () {};
Component.onConnectRequest = function () {};
Component.onCreateRequest = function () {};
Component.onDeleteRequest = function () {};
Component.onDeleteReqDelay = function () {};
Component.onCancelDeleteRequest = function () {};
Component.onRenameRequest = function () {};

export default UIManager.addComponent(Component);
