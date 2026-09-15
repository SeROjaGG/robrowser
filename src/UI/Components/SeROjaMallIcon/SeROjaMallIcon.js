/**
 * UI/Components/SeROjaMallIcon/SeROjaMallIcon.js
 *
 * Equipment Mall Icon — opens SeROjaMall (PLAN-018 Phase D4c has no icon button,
 * Ctrl+Shift+E only). Mirrors CashShopIcon's pattern exactly.
 */
import SeROjaMall from 'UI/Components/SeROjaMall/SeROjaMall.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import 'UI/Elements/Elements.js';
import htmlText from './SeROjaMallIcon.html?raw';
import cssText from './SeROjaMallIcon.css?raw';
import themeText from '../SeROjaCommon/glassTheme.css?raw';

const SeROjaMallIcon = new GUIComponent('SeROjaMallIcon', themeText + cssText);

SeROjaMallIcon.render = () => htmlText;

SeROjaMallIcon.init = function init() {
	const root = this.getRoot();
	const btn = root.querySelector('.mall-icon');
	if (btn) {
		btn.addEventListener('mousedown', e => e.stopImmediatePropagation());
		btn.addEventListener('click', () => SeROjaMall.toggle());
	}
};

SeROjaMallIcon.needFocus = false;
SeROjaMallIcon.mouseMode = GUIComponent.MouseMode.CROSS;

export default UIManager.addComponent(SeROjaMallIcon);
