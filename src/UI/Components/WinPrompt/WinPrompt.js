/**
 * UI/Components/WinPrompt/WinPrompt.js
 *
 * Prompt window
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import WinPopup from 'UI/Components/WinPopup.js';
import GraphicsSettings from 'Preferences/Graphics.js';

const isClassic = GraphicsSettings.uiSkin === 'classic';

/**
 * Create Component
 */
const WinPrompt = WinPopup.clone('WinPrompt');

/**
 * Initialize popup
 */
WinPrompt.init = function init() {
	this.draggable();
};

/**
 * Ask for something
 *
 * @param {string} text - question to ask
 * @param {string} btn_yes - first button name
 * @param {string} btn_no - second button name
 * @param {function} onYes - callback for first button
 * @param {function} onNo - callback for second button
 */
WinPrompt.ask = function ask(text, btn_yes, btn_no, onYes, onNo) {
	if (!this.__loaded) this.prepare();

	const root = this.getRoot();

	// Set text
	const textEl = root.querySelector('.text');
	if (textEl) {
		textEl.textContent = text;
	}

	// Clear existing buttons
	const btnsEl = root.querySelector('.btns');
	if (btnsEl) {
		btnsEl.innerHTML = '';

		// Create YES button — the caller passes a semantic name (btn_yes, btn_ok,
		// btn_retry, ...) that used to select a pre-labelled BMP; the SeROja skin
		// reuses that same name as the glass button's text instead of the image.
		const yesBtn = document.createElement('button');
		if (isClassic) {
			yesBtn.className = 'btn';
			yesBtn.dataset.background = 'btn_' + btn_yes + '.bmp';
			yesBtn.dataset.hover = 'btn_' + btn_yes + '_a.bmp';
			yesBtn.dataset.down = 'btn_' + btn_yes + '_b.bmp';
			GUIComponent.processDataAttrs(yesBtn);
		} else {
			yesBtn.className = 'btn sj-btn primary';
			yesBtn.textContent = btn_yes.charAt(0).toUpperCase() + btn_yes.slice(1);
		}
		yesBtn.addEventListener(
			'click',
			function () {
				WinPrompt.remove();
				if (onYes) {
					onYes();
				}
			},
			{ once: true }
		);

		// Create NO button
		const noBtn = document.createElement('button');
		if (isClassic) {
			noBtn.className = 'btn';
			noBtn.dataset.background = 'btn_' + btn_no + '.bmp';
			noBtn.dataset.hover = 'btn_' + btn_no + '_a.bmp';
			noBtn.dataset.down = 'btn_' + btn_no + '_b.bmp';
			GUIComponent.processDataAttrs(noBtn);
		} else {
			noBtn.className = 'btn sj-btn';
			noBtn.textContent = btn_no.charAt(0).toUpperCase() + btn_no.slice(1);
		}
		noBtn.addEventListener(
			'click',
			function () {
				WinPrompt.remove();
				if (onNo) {
					onNo();
				}
			},
			{ once: true }
		);

		btnsEl.appendChild(yesBtn);
		btnsEl.appendChild(noBtn);
	}

	// Append and process remaining data-* attrs
	this.append();
};

/**
 * Create component based on view file and export it
 */
export default UIManager.addComponent(WinPrompt);
