/**
 * UI/Components/WinPopup/Winpopup.js
 *
 * Popup windows
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import Renderer from 'Renderer/Renderer.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import 'UI/Elements/Elements.js';
import htmlText from './WinPopup.html?raw';
import htmlTextClassic from './WinPopup.classic.html?raw';
import cssText from './WinPopup.css?raw';
import cssTextClassic from './WinPopup.classic.css?raw';
import themeText from 'UI/Components/SeROjaCommon/glassTheme.css?raw';
import GraphicsSettings from 'Preferences/Graphics.js';

/**
 * Create Component
 */
const isClassic = GraphicsSettings.uiSkin === 'classic';
const WinPopup = new GUIComponent('WinPopup', isClassic ? cssTextClassic : themeText + cssText);

WinPopup.render = () => (isClassic ? htmlTextClassic : htmlText);

/**
 * Initialize popup
 */
WinPopup.init = function init() {
	Object.assign(this._host.style, {
		top: `${(Renderer.height - 120) / 1.5 - 120}px`,
		left: `${(Renderer.width - 280) / 2.0}px`,
		zIndex: '100'
	});
};

WinPopup.needFocus = true;
WinPopup.mouseMode = GUIComponent.MouseMode.FREEZE;

/**
 * Create component based on view file and export it
 */
export default UIManager.addComponent(WinPopup);
