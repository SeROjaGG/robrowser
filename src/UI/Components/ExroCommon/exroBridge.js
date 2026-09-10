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
 *           dispbottom arrives as ZC.NOTIFY_PLAYERCHAT (0x8e). Rather than
 *           re-hook that packet (hook order is fragile — the previous attempt
 *           left EXRO lines leaking to the chatbox), Main.js onPlayerMessage
 *           calls consume() first and returns early when it swallows a line.
 *           consume() swallows ANY well-formed EXRO line — live nonce or not —
 *           so a reply that lands after its 5 s timeout never reaches the chat.
 *
 * request(prefix, op, args?) -> Promise<string[][]>   (array of ROW field arrays)
 *   resolves on END, rejects on ERR or a 5 s timeout.
 */
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import Session from 'Engine/SessionStorage.js';

const TIMEOUT_MS = 5000;
const PREFIX = 'EXRO\t';

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

/**
 * Handle one incoming chat line. Called from Main.js onPlayerMessage before it
 * touches the chatbox.
 * @param {string} msg
 * @return {boolean} true if this was an EXRO protocol line and must NOT be shown
 */
export function consume(msg) {
	if (typeof msg !== 'string' || msg.lastIndexOf(PREFIX, 0) !== 0) {
		return false;
	}
	const parts = msg.split('\t'); // ['EXRO', nonce, kind, ...fields]
	const nonce = Number(parts[1]);
	const req = _pending.get(nonce);
	if (req) {
		const kind = parts[2];
		if (kind === 'ROW') {
			req.rows.push(parts.slice(3));
		} else if (kind === 'END') {
			finish(nonce, null);
		} else if (kind === 'ERR') {
			finish(nonce, parts[3] || 'server error');
		}
	}
	// Swallow every EXRO line, even a stale one whose request already timed out —
	// the alternative is protocol noise in the player's chatbox.
	return true;
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
	const nonce = _nonce++;
	const promise = new Promise((resolve, reject) => {
		const timer = setTimeout(() => finish(nonce, 'timeout'), TIMEOUT_MS);
		_pending.set(nonce, { rows: [], resolve, reject, timer });
	});
	const tail = args && args.length ? ' ' + args.join(' ') : '';
	send(prefix, `${nonce} ${op}${tail}`);
	return promise;
}

export default { request, consume };
