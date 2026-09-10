/**
 * UI/Components/ExroMall/ExroMall.js
 *
 * eXRo in-client Equipment Mall window (PLAN-018 Phase D / D4c). A curated zeny
 * sink over www_mall_catalog, mirroring the in-town Equipment Mall NPC. Data +
 * buys go through exroBridge (chat-atcommand transport); the map-server catalog
 * is job-filtered server-side, and the buy debits Zeny then delivers
 * (F_ExroMallBuy in npc/custom/exro/mall.txt).
 *
 * Standalone GUIComponent, additively registered in Engine/MapEngine.js.
 */
import KEYS from 'Controls/KeyEventHandler.js';
import Preferences from 'Core/Preferences.js';
import Renderer from 'Renderer/Renderer.js';
import Session from 'Engine/SessionStorage.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import { request } from '../ExroCommon/exroBridge.js';
import htmlText from './ExroMall.html?raw';
import cssText from '../ExroCommon/exroShop.css?raw';

const ExroMall = new GUIComponent('ExroMall', cssText);
ExroMall.render = () => htmlText;

const _prefs = Preferences.get('ExroMall', { x: 160, y: 110 }, 1.0);

let _page = 0;
let _cat = '-';
let _armed = null;
let _armTimer = null;

function $(sel) {
	return ExroMall.getRoot().querySelector(sel);
}

function setStatus(text, cls) {
	const el = $('.st');
	el.textContent = text || '';
	el.className = 'st' + (cls ? ' ' + cls : '');
}

function zeny(n) {
	return Number(n).toLocaleString() + 'z';
}

function packs() {
	return Math.max(1, Math.min(99, parseInt($('.qty').value, 10) || 1));
}

function disarm() {
	_armed = null;
	if (_armTimer) {
		clearTimeout(_armTimer);
		_armTimer = null;
	}
}

function empty(msg) {
	const list = $('.exs-list');
	list.textContent = '';
	const d = document.createElement('div');
	d.className = 'exs-empty';
	d.textContent = msg;
	list.appendChild(d);
}

function render(rows) {
	const list = $('.exs-list');
	list.textContent = '';
	if (!rows.length) {
		empty(_page === 0 ? 'Nothing here for your class yet.' : 'No more items.');
		return;
	}
	const p = packs();
	rows.forEach(([id, name, per, price]) => {
		const row = document.createElement('div');
		row.className = 'exs-row';
		row.innerHTML =
			'<span class="nm"></span><span class="sub"></span>' +
			'<span class="price"></span><button></button>';
		row.querySelector('.nm').textContent = name;
		row.querySelector('.sub').textContent = 'x' + per * p;
		row.querySelector('.price').textContent = zeny(Number(price) * p);
		const btn = row.querySelector('button');
		btn.textContent = _armed === id ? 'Confirm' : 'Buy';
		btn.className = _armed === id ? 'confirm' : '';
		btn.dataset.id = id;
		btn.dataset.name = name;
		list.appendChild(row);
	});
}

async function refresh() {
	$('.pgn').textContent = String(_page + 1);
	$('.prev').disabled = _page === 0;
	$('.wallet-mini').textContent = 'zeny ' + zeny(Session.zeny || 0);
	setStatus('loading…');
	disarm();
	try {
		const rows = await request('exml', 'browse', [_cat, _page]);
		$('.next').disabled = rows.length < 8;
		render(rows);
		setStatus('');
	} catch (e) {
		empty('Could not reach the mall.');
		setStatus(e.message || 'error', 'err');
	}
}

async function buy(id, name) {
	const p = packs();
	setStatus('buying…');
	try {
		await request('exml', 'buy', [id, p]);
		setStatus('Bought ' + p + '× ' + name + '.', 'ok');
	} catch (e) {
		setStatus('Buy failed: ' + (e.message || 'error'), 'err');
	}
	disarm();
	await refresh();
}

ExroMall.init = function init() {
	const root = this.getRoot();
	this.draggable(root.querySelector('.exs-bar'));

	root.querySelector('.x').addEventListener('click', () => this.remove());
	root.querySelector('.cat').addEventListener('change', e => {
		_cat = e.target.value;
		_page = 0;
		refresh();
	});
	root.querySelector('.qty').addEventListener('change', () => refresh());
	root.querySelector('.prev').addEventListener('click', () => {
		if (_page > 0) {
			_page--;
			refresh();
		}
	});
	root.querySelector('.next').addEventListener('click', () => {
		_page++;
		refresh();
	});
	root.querySelector('.exs-list').addEventListener('click', e => {
		const btn = e.target.closest('button');
		if (!btn || !btn.dataset.id) {
			return;
		}
		const { id, name } = btn.dataset;
		if (_armed === id) {
			buy(id, name);
			return;
		}
		disarm();
		_armed = id;
		_armTimer = setTimeout(() => {
			disarm();
			root.querySelectorAll('.exs-list button').forEach(b => {
				b.textContent = 'Buy';
				b.className = '';
			});
		}, 4000);
		btn.textContent = 'Confirm';
		btn.className = 'confirm';
	});
};

ExroMall.onAppend = function onAppend() {
	this._host.style.left =
		Math.min(Math.max(0, _prefs.x), Renderer.width - this._host.offsetWidth) + 'px';
	this._host.style.top =
		Math.min(Math.max(0, _prefs.y), Renderer.height - this._host.offsetHeight) + 'px';
	_page = 0;
	refresh();
};

ExroMall.onRemove = function onRemove() {
	_prefs.x = parseInt(this._host.style.left, 10) || _prefs.x;
	_prefs.y = parseInt(this._host.style.top, 10) || _prefs.y;
	_prefs.save();
	disarm();
};

ExroMall.onKeyDown = function onKeyDown(event) {
	if (event.which === KEYS.ESCAPE) {
		this.remove();
		event.stopImmediatePropagation();
		return false;
	}
	return true;
};

ExroMall.onShortCut = function onShortCut(key) {
	if (key.cmd === 'TOGGLE') {
		this.toggle();
	}
};

ExroMall.toggle = function toggle() {
	if (this.__active) {
		this.remove();
	} else {
		this.append();
	}
};

ExroMall.mouseMode = GUIComponent.MouseMode.STOP;
ExroMall.captureKeyEvents = true;
ExroMall.needFocus = true;

export default UIManager.addComponent(ExroMall);
