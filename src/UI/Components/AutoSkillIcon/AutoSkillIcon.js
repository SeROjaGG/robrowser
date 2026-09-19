/**
 * UI/Components/AutoSkillIcon/AutoSkillIcon.js
 *
 * Toggle button: cast an offensive skill on the current target instead of
 * (or alongside) a plain attack. No per-skill damage data exists client-side
 * (SkillInfo.js has no power field), so "strongest first" is approximated by
 * SP cost — pricier skills are consistently the harder-hitting ones across
 * every job tree, and it needs no per-class table to maintain.
 */
import Session from 'Engine/SessionStorage.js';
import EntityManager from 'Renderer/EntityManager.js';
import SkillWindow from 'UI/Components/SkillList/SkillList.js';
import SkillTargetSelection from 'UI/Components/SkillTargetSelection/SkillTargetSelection.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import 'UI/Elements/Elements.js';
import htmlText from './AutoSkillIcon.html?raw';
import cssText from './AutoSkillIcon.css?raw';

const AutoSkillIcon = new GUIComponent('AutoSkillIcon', cssText);

AutoSkillIcon.render = () => htmlText;

const TICK_DELAY = 500;
// Own conservative re-cast spacing per skill id. The server has the real
// aftercast delay; this just stops us re-trying the same skill every tick.
const SKILL_COOLDOWN = 3000;
const nextAllowed = new Map();
let timer = null;

function pickSkill() {
	const list = SkillWindow.getUI().getSkillList();
	if (!list || !list.length) {
		return null;
	}

	const sp = Session.Entity.life.sp;
	const now = Date.now();
	let best = null;

	for (const skill of list) {
		if (!(skill.type & SkillTargetSelection.TYPE.ENEMY)) {
			continue;
		}
		if (skill.level <= 0 || skill.spcost > sp) {
			continue;
		}
		if ((nextAllowed.get(skill.SKID) || 0) > now) {
			continue;
		}
		if (!best || skill.spcost > best.spcost) {
			best = skill;
		}
	}

	return best;
}

function tick() {
	if (Session.Entity && Session.Playing) {
		const target = EntityManager.getFocusEntity();
		if (target && target.action !== target.ACTION.DIE) {
			const skill = pickSkill();
			if (skill) {
				SkillTargetSelection.onUseSkillToId(skill.SKID, skill.level, target.GID);
				nextAllowed.set(skill.SKID, Date.now() + SKILL_COOLDOWN);
			}
		}
	}

	if (Session.autoSkillEnabled) {
		timer = window.setTimeout(tick, TICK_DELAY);
	}
}

function toggle() {
	Session.autoSkillEnabled = !Session.autoSkillEnabled;
	AutoSkillIcon.getRoot().querySelector('.auto-skill-icon').classList.toggle('active', Session.autoSkillEnabled);

	if (Session.autoSkillEnabled) {
		tick();
	} else {
		window.clearTimeout(timer);
	}
}

AutoSkillIcon.init = function init() {
	const root = this.getRoot();
	const btn = root.querySelector('.auto-skill-icon');
	btn.addEventListener('mousedown', e => e.stopImmediatePropagation());
	btn.addEventListener('click', toggle);
};

AutoSkillIcon.needFocus = false;
AutoSkillIcon.mouseMode = GUIComponent.MouseMode.CROSS;

export default UIManager.addComponent(AutoSkillIcon);
