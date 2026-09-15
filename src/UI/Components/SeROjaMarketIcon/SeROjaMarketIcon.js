/**
 * UI/Components/SeROjaMarketIcon/SeROjaMarketIcon.js
 *
 * Player Market Icon — opens SeROjaMarket (PLAN-018 Phase D3c has no icon button,
 * Ctrl+E only). Mirrors CashShopIcon's pattern exactly.
 */
import SeROjaMarket from 'UI/Components/SeROjaMarket/SeROjaMarket.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import 'UI/Elements/Elements.js';
import htmlText from './SeROjaMarketIcon.html?raw';
import cssText from './SeROjaMarketIcon.css?raw';
import themeText from '../SeROjaCommon/glassTheme.css?raw';

const SeROjaMarketIcon = new GUIComponent('SeROjaMarketIcon', themeText + cssText);

SeROjaMarketIcon.render = () => htmlText;

SeROjaMarketIcon.init = function init() {
	const root = this.getRoot();
	const btn = root.querySelector('.market-icon');
	if (btn) {
		btn.addEventListener('mousedown', e => e.stopImmediatePropagation());
		btn.addEventListener('click', () => SeROjaMarket.toggle());
	}
};

SeROjaMarketIcon.needFocus = false;
SeROjaMarketIcon.mouseMode = GUIComponent.MouseMode.CROSS;

export default UIManager.addComponent(SeROjaMarketIcon);
