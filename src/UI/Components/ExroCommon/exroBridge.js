/**
 * UI/Components/ExroCommon/exroBridge.js
 *
 * eXRo client <-> map-server data bridge for the ExroMarket / ExroMall windows
 * (PLAN-018 Phase D / D3c-D4c). No new packet, no C++ change, no www route.
 *
 * Send    : a CZ.REQUEST_CHAT carrying "@<prefix> <nonce> <op> <args...>"
 *           (prefix 'exmk' = market, 'exml' = mall). rAthena runs the
 *           bindatcmd-bound OnCmd label in npc/custom/exro/{market_client,mall}.txt.
 * Receive : the NPC dispbottom's TSV lines
 *              EXRO <TAB> <nonce> <TAB> ROW <TAB> <f0> <TAB> <f1> ...
 *              EXRO <TAB> <nonce> <TAB> END <TAB> <op>
 *              EXRO <TAB> <nonce> <TAB> ERR <TAB> <reason>
 *           dispbottom arrives as ZC.NOTIFY_PLAYERCHAT (0x8e). roBrowser's
 *           hookPacket is last-wins, so on the first request() we re-hook that
 *           packet: EXRO-prefixed lines for a live nonce are consumed here;
 *           every other line is passed to Main.js onPlayerMessage untouched, so
 *           the chatbox and overhead dialog keep working. The hook is installed
 *           lazily (after MainEngine() has run its own hookPacket) and stays.
 *
 * request(prefix, op, args?) -> Promise<string[][]>   (array of ROW field arrays)
 *   resolves on END, rejects on ERR or a 5 s timeout.
 */
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import Session from 'Engine/SessionStorage.js';
import { onPlayerMessage } from 'Engine/MapEngine/Main.js';

const TIMEOUT_MS = 5000;
const PREFIX = 'EXRO\t';

let _installed = false;
let _nonce = 1;
const _pending = new Map(); // nonce -> { rows, resolve, reject, timer }

function finish(nonce, err) {
	const req = _pending.get(nonce);
	if (!req) {
		return;
	}
	clearTimeout(req.timer);
	_pending.delete(nonce);
	if (err) {
		req.reject(new Error(err));
	} else {
		req.resolve(req.rows);
	}
}

function consume(msg) {
	const parts = msg.split('\t'); // ['EXRO', nonce, kind, ...fields]
	const nonce = Number(parts[1]);
	const req = _pending.get(nonce);
	if (!req) {
		return false; // not ours / already resolved -> let it through
	}
	const kind = parts[2];
	if (kind === 'ROW') {
		req.rows.push(parts.slice(3));
	} else if (kind === 'END') {
		finish(nonce, null);
	} else if (kind === 'ERR') {
		finish(nonce, parts[3] || 'server error');
	}
	return true;
}

function install() {
	if (_installed) {
		return;
	}
	Network.hookPacket(PACKET.ZC.NOTIFY_PLAYERCHAT, pkt => {
		if (pkt && typeof pkt.msg === 'string' && pkt.msg.lastIndexOf(PREFIX, 0) === 0 && consume(pkt.msg)) {
			return;
		}
		onPlayerMessage(pkt);
	});
	_installed = true;
}

function send(prefix, payload) {
	const pkt = new PACKET.CZ.REQUEST_CHAT();
	const name = (Session.Entity && Session.Entity.display && Session.Entity.display.name) || '';
	pkt.msg = `${name} : @${prefix} ${payload}`;
	Network.sendPacket(pkt);
}

/**
 * @param {string} prefix 'exmk' | 'exml'
 * @param {string} op
 * @param {Array<string|number>} [args]
 * @return {Promise<string[][]>}
 */
export function request(prefix, op, args) {
	install();
	const nonce = _nonce++;
	const promise = new Promise((resolve, reject) => {
		const timer = setTimeout(() => finish(nonce, 'timeout'), TIMEOUT_MS);
		_pending.set(nonce, { rows: [], resolve, reject, timer });
	});
	const tail = args && args.length ? ' ' + args.join(' ') : '';
	send(prefix, `${nonce} ${op}${tail}`);
	return promise;
}

export default { request };
