/**
 * UI/Components/AutoAttackIcon/AutoAttackIcon.js
 *
 * Toggle button: keep attacking the nearest monster without clicking.
 * Only picks a new target when there's none focused (or the current one
 * died) — the server's own auto-attack timer handles the rest, same as a
 * normal manual click.
 */
import Session from 'Engine/SessionStorage.js';
import EntityManager from 'Renderer/EntityManager.js';
import Entity from 'Renderer/Entity/Entity.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import 'UI/Elements/Elements.js';
import htmlText from './AutoAttackIcon.html?raw';
import cssText from './AutoAttackIcon.css?raw';

const AutoAttackIcon = new GUIComponent('AutoAttackIcon', cssText);

AutoAttackIcon.render = () => htmlText;

const TICK_DELAY = 500;
let timer = null;

function tick() {
	const player = Session.Entity;
	if (!player || !Session.Playing) {
		return;
	}

	const current = EntityManager.getFocusEntity();
	if (!current || current.action === current.ACTION.DIE) {
		const closest = EntityManager.getClosestEntity(player, Entity.TYPE_MOB);
		if (closest) {
			closest.onFocus();
			EntityManager.setFocusEntity(closest);
		}
	}

	if (Session.autoAttackEnabled) {
		timer = window.setTimeout(tick, TICK_DELAY);
	}
}

function toggle() {
	Session.autoAttackEnabled = !Session.autoAttackEnabled;
	AutoAttackIcon.getRoot().querySelector('.auto-attack-icon').classList.toggle('active', Session.autoAttackEnabled);

	if (Session.autoAttackEnabled) {
		tick();
	} else {
		window.clearTimeout(timer);
	}
}

AutoAttackIcon.init = function init() {
	const root = this.getRoot();
	const btn = root.querySelector('.auto-attack-icon');
	btn.addEventListener('mousedown', e => e.stopImmediatePropagation());
	btn.addEventListener('click', toggle);
};

AutoAttackIcon.needFocus = false;
AutoAttackIcon.mouseMode = GUIComponent.MouseMode.CROSS;

export default UIManager.addComponent(AutoAttackIcon);
