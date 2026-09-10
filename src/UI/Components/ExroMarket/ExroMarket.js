/**
 * UI/Components/ExroMarket/ExroMarket.js
 *
 * eXRo in-client Player Market window (PLAN-018 Phase D / D3c). Browse + buy
 * over the same www_market_* tables as the website /market and the in-town
 * Market Kiosk NPC. Data comes through exroBridge (chat-atcommand transport,
 * no new packet). Buys settle on the map-server via F_ExroMktBuy — the website
 * buyListing stays the canonical path (ADR-0011).
 *
 * Standalone GUIComponent, additively registered in Engine/MapEngine.js.
 * *Common.js files untouched (ADR-0013 pattern).
 *
 * Sell is intentionally NOT here yet — creating a listing + depositing the item
 * in one in-game step is a new money path; for now the Sell flow is the website
 * + the Market Broker NPC.
 */
import KEYS from 'Controls/KeyEventHandler.js';
import Preferences from 'Core/Preferences.js';
import Renderer from 'Renderer/Renderer.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import { request } from '../ExroCommon/exroBridge.js';
import htmlText from './ExroMarket.html?raw';
import cssText from '../ExroCommon/exroShop.css?raw';

const ExroMarket = new GUIComponent('ExroMarket', cssText);
ExroMarket.render = () => htmlText;

const _prefs = Preferences.get('ExroMarket', { x: 120, y: 90 }, 1.0);

let _tab = 'browse';
let _page = 0;
let _cat = '-';
let _wallet = 0;
let _armed = null; // listing id awaiting a confirm click
let _armTimer = null;

/* ── helpers ─────────────────────────────────────────────── */

function $(sel) {
	return ExroMarket.getRoot().querySelector(sel);
}

function setStatus(text, cls) {
	const el = $('.st');
	el.textContent = text || '';
	el.className = 'st' + (cls ? ' ' + cls : '');
}

function zeny(n) {
	return Number(n).toLocaleString() + 'z';
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

/* ── rendering ───────────────────────────────────────────── */

function renderBrowse(rows) {
	const list = $('.exs-list');
	list.textContent = '';
	if (!rows.length) {
		empty(_page === 0 ? 'Nothing listed in that category.' : 'No more listings.');
		return;
	}
	rows.forEach(([id, name, qty, price, seller]) => {
		const row = document.createElement('div');
		row.className = 'exs-row';
		row.innerHTML =
			'<span class="nm"></span><span class="sub">x</span>' +
			'<span class="price"></span><button></button>';
		row.querySelector('.nm').textContent = name;
		row.querySelector('.sub').textContent = 'x' + qty + ' · ' + seller;
		row.querySelector('.price').textContent = zeny(price);
		const btn = row.querySelector('button');
		const affordable = Number(price) <= _wallet;
		btn.textContent = _armed === id ? 'Confirm' : 'Buy';
		btn.className = _armed === id ? 'confirm' : '';
		btn.disabled = !affordable && _armed !== id;
		btn.dataset.id = id;
		btn.dataset.price = price;
		btn.dataset.name = name;
		list.appendChild(row);
	});
}

function renderTable(rows, cols) {
	const list = $('.exs-list');
	list.textContent = '';
	if (!rows.length) {
		empty('Nothing here.');
		return;
	}
	rows.forEach(r => {
		const row = document.createElement('div');
		row.className = 'exs-row';
		row.innerHTML = '<span class="nm"></span><span class="price"></span><span class="tag"></span>';
		row.querySelector('.nm').textContent = r[cols.name];
		row.querySelector('.price').textContent = cols.price != null ? zeny(r[cols.price]) : '';
		row.querySelector('.tag').textContent =
			(cols.qty != null ? 'x' + r[cols.qty] + '  ' : '') + '[' + r[cols.status] + ']';
		list.appendChild(row);
	});
}

/* ── data ────────────────────────────────────────────────── */

async function fetchWallet() {
	try {
		const rows = await request('exmk', 'wallet');
		_wallet = Number((rows[0] && rows[0][0]) || 0);
	} catch {
		_wallet = 0;
	}
	const mini = $('.wallet-mini');
	if (mini) {
		mini.textContent = 'wallet ' + zeny(_wallet);
	}
}

async function refresh() {
	const root = ExroMarket.getRoot();
	root.querySelectorAll('.exs-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === _tab));
	$('.exs-filters').style.display = _tab === 'browse' ? '' : 'none';
	$('.exs-foot .pg').style.display = _tab === 'browse' ? '' : 'none';
	$('.pgn').textContent = String(_page + 1);
	$('.prev').disabled = _page === 0;
	setStatus('loading…');
	disarm();

	try {
		if (_tab === 'browse') {
			await fetchWallet();
			const rows = await request('exmk', 'browse', [_cat, _page]);
			$('.next').disabled = rows.length < 8;
			renderBrowse(rows);
			setStatus(rows.length ? '' : '');
		} else if (_tab === 'mine') {
			const rows = await request('exmk', 'mine');
			renderTable(rows, { name: 0, qty: 1, price: 2, status: 3 });
			setStatus('');
		} else if (_tab === 'orders') {
			const rows = await request('exmk', 'orders');
			renderTable(rows, { name: 0, price: 1, status: 2 });
			setStatus('');
		} else if (_tab === 'wallet') {
			await fetchWallet();
			empty('Market wallet: ' + zeny(_wallet) + '\nTop up at the Market Broker or the website.');
			setStatus('');
		}
	} catch (e) {
		empty('Could not reach the market.');
		setStatus(e.message || 'error', 'err');
	}
}

async function buy(id, price, name) {
	setStatus('buying…');
	try {
		await request('exmk', 'buy', [id]);
		setStatus('Bought ' + name + ' — check RODEX.', 'ok');
	} catch (e) {
		setStatus('Buy failed: ' + (e.message || 'error'), 'err');
	}
	disarm();
	await refresh();
}

/* ── events ──────────────────────────────────────────────── */

ExroMarket.init = function init() {
	const root = this.getRoot();
	this.draggable(root.querySelector('.exs-bar'));

	root.querySelector('.x').addEventListener('click', () => this.remove());
	root.querySelectorAll('.exs-tabs button').forEach(b =>
		b.addEventListener('click', () => {
			_tab = b.dataset.tab;
			_page = 0;
			refresh();
		})
	);
	root.querySelector('.cat').addEventListener('change', e => {
		_cat = e.target.value;
		_page = 0;
		refresh();
	});
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
		const { id, price, name } = btn.dataset;
		if (_armed === id) {
			buy(id, Number(price), name);
			return;
		}
		disarm();
		_armed = id;
		_armTimer = setTimeout(() => {
			disarm();
			if (_tab === 'browse') {
				renderBrowseFromDom();
			}
		}, 4000);
		btn.textContent = 'Confirm';
		btn.className = 'confirm';
	});
};

// re-skin buttons after a disarm without a server round-trip
function renderBrowseFromDom() {
	ExroMarket.getRoot()
		.querySelectorAll('.exs-list button')
		.forEach(btn => {
			btn.textContent = 'Buy';
			btn.className = '';
			btn.disabled = Number(btn.dataset.price) > _wallet;
		});
}

ExroMarket.onAppend = function onAppend() {
	this._host.style.left =
		Math.min(Math.max(0, _prefs.x), Renderer.width - this._host.offsetWidth) + 'px';
	this._host.style.top =
		Math.min(Math.max(0, _prefs.y), Renderer.height - this._host.offsetHeight) + 'px';
	_tab = 'browse';
	_page = 0;
	refresh();
};

ExroMarket.onRemove = function onRemove() {
	_prefs.x = parseInt(this._host.style.left, 10) || _prefs.x;
	_prefs.y = parseInt(this._host.style.top, 10) || _prefs.y;
	_prefs.save();
	disarm();
};

ExroMarket.onKeyDown = function onKeyDown(event) {
	if (event.which === KEYS.ESCAPE) {
		this.remove();
		event.stopImmediatePropagation();
		return false;
	}
	return true;
};

ExroMarket.onShortCut = function onShortCut(key) {
	if (key.cmd === 'TOGGLE') {
		this.toggle();
	}
};

ExroMarket.toggle = function toggle() {
	if (this.__active) {
		this.remove();
	} else {
		this.append();
	}
};

ExroMarket.mouseMode = GUIComponent.MouseMode.STOP;
ExroMarket.captureKeyEvents = true;
ExroMarket.needFocus = true;

export default UIManager.addComponent(ExroMarket);
