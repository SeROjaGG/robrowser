/**
 * UI/Components/WinStats/WinStatsV2.js
 *
 * Chararacter Statistiques Informations
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import htmlText from './WinStatsV2.html?raw';
import htmlTextClassic from './WinStatsV2.classic.html?raw';
import cssText from './WinStatsV2.css?raw';
import cssTextClassic from './WinStatsV2.classic.css?raw';
import { createWinStats } from '../WinStatsCommon.js';

export default createWinStats({
	name: 'WinStatsV2',
	htmlText,
	cssText,
	htmlTextClassic,
	cssTextClassic,
	hasTraits: true
});
