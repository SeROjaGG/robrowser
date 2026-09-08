/**
 * UI/Components/CharCreate/CharCreateExro/CharCreateExro.js
 *
 * eXRo custom character-create screen (PLAN-009).
 *
 * Standalone GUIComponent — implements the CharEngine API directly, does NOT
 * go through createCharCreate(). CharCreateCommon.js is untouched. Registered
 * at PACKETVER 20251001 in ../CharCreate.js.
 *
 * ── Engine contract (verified against src/Engine/CharEngine.js 2026-09-09) ──
 *   render() / init() / onAppend() / onRemove() / onKeyDown()
 *   setAccountSex(sex)            -> default gender seed
 *   callbacks set by the engine:
 *     onExitRequest()
 *     onCharCreationRequest(name, Str, Agi, Vit, Int, Dex, Luk, hair, color, job, sex)
 *       -- POSITIONAL. At 20251001 the engine sends MAKE_CHAR3 (0xa39), which uses
 *          only name/head/headPal/CharNum/Job/Sex; Str..Luk are placeholders.
 *          `job` carries the race: 0 = Human/Novice, 4218 = Doram/Summoner.
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */

import KEYS from 'Controls/KeyEventHandler.js';
import Renderer from 'Renderer/Renderer.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import 'UI/Elements/Elements.js';
import { makePreviewEntity, drawPreviewEntity } from '../../CharSelect/charSprite.js';
import htmlText from './CharCreateExro.html?raw';
import cssText from './CharCreateExro.css?raw';

/** preview sprite anchor inside the cc-canvas (190x250) */
const PREVIEW_ANCHOR = { x: 95, y: 236 };

/* stepper bounds. Hair style: kRO human range. Hair color: 0 = the sprite's own
   colours, 1..8 = kRO head palettes. Steppers WRAP at the ends. */
const HAIR_MIN = 1;
const HAIR_MAX = 27;
const COLOR_MIN = 0;
const COLOR_MAX = 8;

const Component = new GUIComponent('CharCreateExro', cssText);

Component.render = () => htmlText;

const _state = { name: '', race: 0, sex: 1, hairStyle: 1, hairColor: 0, direction: 4 };
let _entity = null;
let _bodyKey = ''; // race|sex — a change here needs a full sprite rebuild
let _loopFn = null;
let _doramEnabled = true; // flipped off by Task 6 if the Doram sprite is missing

function wrap(v, min, max) {
	const span = max - min + 1;
	return min + (((v - min) % span) + span) % span;
}

// Full rebuild only when race or sex changes (whole body sprite swaps). Hair
// style / colour / direction are poked onto the live entity below, the way
// CharCreateCommon.js does it — rebuilding per keystroke leaves the head palette
// stale because the head sprite reloads async.
function ensureEntity() {
	const key = `${_state.race}|${_state.sex}`;
	if (!_entity || key !== _bodyKey) {
		_entity = makePreviewEntity({
			job: _state.race,
			sex: _state.sex,
			head: _state.hairStyle,
			headpalette: _state.hairColor,
			direction: _state.direction
		});
		_bodyKey = key;
	} else {
		_entity.head = _state.hairStyle;
		_entity.headpalette = _state.hairColor;
		_entity.direction = _state.direction;
	}
}

function syncPanel() {
	const root = Component.getRoot();
	root.querySelectorAll('.cc-race button').forEach(b => b.classList.toggle('on', +b.dataset.race === _state.race));
	root.querySelectorAll('.cc-sex button').forEach(b => b.classList.toggle('on', +b.dataset.sex === _state.sex));
	root.querySelector('.cc-hair .val').textContent = String(_state.hairStyle);
	root.querySelector('.cc-color .val').textContent = String(_state.hairColor);
	root.querySelector('.cc-card .jb').textContent =
		`${_state.race === 4218 ? 'Doram' : 'Human'} · ${_state.sex === 1 ? 'Male' : 'Female'}`;
	root.querySelector('.cc-race button[data-race="4218"]').disabled = !_doramEnabled;

	// Hair-colour palettes: DB.getHeadPalPath resolves data/palette/도람족/머리/… for
	// Doram (present in the client pack) but data/palette/머리/… for Human (NOT in the
	// pack — same missing-KR-asset gap as the mojibake map names). Hide the control
	// where it can't do anything; drop this guard once the Human palettes ship.
	root.querySelector('.cc-row.cc-color-row').hidden = _state.race !== 4218;

	ensureEntity();
}

function hint(msg) {
	Component.getRoot().querySelector('.cc-hint').textContent = msg || '';
}

function renderLoop() {
	const root = Component.getRoot();
	const ctx = root.querySelector('.cc-canvas').getContext('2d');
	drawPreviewEntity(ctx, _entity, PREVIEW_ANCHOR.x, PREVIEW_ANCHOR.y);
}

function rotate(step) {
	_state.direction = (_state.direction + step + 8) % 8;
	if (_entity) {
		_entity.direction = _state.direction;
	}
}

function create() {
	const root = Component.getRoot();
	const name = root.querySelector('.cc-name').value.trim();
	if (!name) {
		hint('Enter a name.');
		return;
	}
	if (name.length > 23) {
		hint('Name is too long (max 23).');
		return;
	}
	hint('');
	// POSITIONAL — Str..Luk are placeholders the modern packet ignores
	Component.onCharCreationRequest(name, 1, 1, 1, 1, 1, 1, _state.hairStyle, _state.hairColor, _state.race, _state.sex);
}

/* ── engine contract ─────────────────────────────────────── */

Component.init = function init() {
	const root = this.getRoot();

	root.querySelector('.cc-name').addEventListener('mousedown', e => e.stopImmediatePropagation());
	root.querySelector('.cc-name').addEventListener('input', e => {
		_state.name = e.target.value;
		root.querySelector('.cc-card .nm').textContent = e.target.value || ' ';
	});

	root.querySelector('.cc-race').addEventListener('click', e => {
		const b = e.target.closest('button');
		if (!b || b.disabled) {
			return;
		}
		_state.race = +b.dataset.race;
		_state.hairStyle = 1;
		syncPanel();
	});
	root.querySelector('.cc-sex').addEventListener('click', e => {
		const b = e.target.closest('button');
		if (b) {
			_state.sex = +b.dataset.sex;
			syncPanel();
		}
	});
	root.querySelector('.cc-hair').addEventListener('click', e => {
		const b = e.target.closest('button');
		if (b) {
			_state.hairStyle = wrap(_state.hairStyle + +b.dataset.d, HAIR_MIN, HAIR_MAX);
			syncPanel();
		}
	});
	root.querySelector('.cc-color').addEventListener('click', e => {
		const b = e.target.closest('button');
		if (b) {
			_state.hairColor = wrap(_state.hairColor + +b.dataset.d, COLOR_MIN, COLOR_MAX);
			syncPanel();
		}
	});
	root.querySelector('.cc-turn.left').addEventListener('click', () => rotate(-1));
	root.querySelector('.cc-turn.right').addEventListener('click', () => rotate(1));

	root.querySelector('.btn.create').addEventListener('click', create);
	root.querySelector('.cc-back').addEventListener('click', () => Component.onExitRequest());
};

Component.onKeyDown = function onKeyDown(event) {
	if (this._host.style.display === 'none') {
		return true;
	}
	if (event.which === KEYS.ESCAPE) {
		Component.onExitRequest();
	} else if (event.which === KEYS.ENTER) {
		create();
	} else {
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

	const root = this.getRoot();
	root.querySelector('.cc-name').value = '';
	root.querySelector('.cc-card .nm').textContent = ' ';
	_state.name = '';
	_state.hairStyle = 1;
	_state.hairColor = 0;
	_state.direction = 4;
	_entity = null;
	_bodyKey = '';
	hint('');
	syncPanel();

	_loopFn = renderLoop;
	Renderer.render(_loopFn);
	root.querySelector('.cc-name').focus();
};

Component.onRemove = function onRemove() {
	if (_loopFn) {
		Renderer.stop(_loopFn);
		_loopFn = null;
	}
};

Component.setAccountSex = function setAccountSex(sex) {
	_state.sex = typeof sex === 'number' ? sex : 1;
	if (this._host && this._host.parentNode) {
		syncPanel();
	}
};

/* Task 6 hook — CharEngine / a boot flag can disable the Doram segment if the
   Summoner sprite is unavailable in the GRF. Defaults on. */
Component.setDoramEnabled = function setDoramEnabled(on) {
	_doramEnabled = !!on;
	if (!_doramEnabled && _state.race === 4218) {
		_state.race = 0;
	}
	if (this._host && this._host.parentNode) {
		syncPanel();
	}
};

/* PLAN-009: surface a server MAKE_CHAR refusal into the hint line. CharEngine's
   onCreationFail already shows a message box; this is the inline echo. */
Component.creationRefused = function creationRefused(msg) {
	hint(msg || 'That character could not be created.');
};

Component.onExitRequest = function () {};
Component.onCharCreationRequest = function () {};

export default UIManager.addComponent(Component);
