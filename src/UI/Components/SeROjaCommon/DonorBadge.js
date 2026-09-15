/**
 * UI/Components/SeROjaCommon/DonorBadge.js
 *
 * SeROja: small self-view badge for supporters (Graphics Settings > Extras >
 * "Donor rank badge"). Same lifetime-CP >= 500 gate as the Training Ground
 * NPC (npc/custom/seroja/donor.txt), queried once per session over the
 * existing serojaBridge protocol (prefix "exdn", see donor_client.txt) --
 * no new packet.
 *
 * Self-view only: this client asks the server "am I a donor" and renders a
 * badge for the player, same as every other Extras toggle (floating EXP,
 * range rings, ...) only affects what you see on your own screen. Other
 * players' clients have no way to know your donor status without a
 * broadcast mechanism this pass doesn't add.
 */
import GraphicsSettings from 'Preferences/Graphics.js';
import { request } from 'UI/Components/SeROjaCommon/serojaBridge.js';

let _checked = false;
let _isDonor = false;

const badge = document.createElement('div');
badge.className = 'seroja-donor-badge';
Object.assign(badge.style, {
	position: 'fixed',
	top: '108px',
	left: '4px',
	zIndex: 50,
	display: 'none',
	padding: '2px 6px',
	borderRadius: '3px',
	fontSize: '11px',
	fontFamily: 'sans-serif',
	fontWeight: 'bold',
	color: '#3a2a00',
	background: 'linear-gradient(#ffe27a, #d9a441)',
	border: '1px solid #8a6a1a',
	pointerEvents: 'none'
});
badge.textContent = '★ Supporter';

function updateVisibility() {
	badge.style.display = GraphicsSettings.showDonorBadge && _isDonor ? 'block' : 'none';
}

/**
 * Query donor status once per session and show/hide the badge accordingly.
 * Safe to call on every map change -- only fires the request once.
 */
export function refresh() {
	if (!document.body.contains(badge)) {
		document.body.appendChild(badge);
	}
	if (_checked) {
		updateVisibility();
		return;
	}
	_checked = true;
	request('exdn', 'status')
		.then(rows => {
			_isDonor = !!(rows[0] && Number(rows[0][0]) === 1);
			updateVisibility();
		})
		.catch(() => {
			_isDonor = false;
		});
}

export default { refresh };
