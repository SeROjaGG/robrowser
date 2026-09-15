/**
 * UI/Components/MiniMap/MiniMapV2.js
 *
 * MiniMap UI
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import WorldMap from 'UI/Components/WorldMap/WorldMap.js';
import htmlText from './MiniMapV2.html?raw';
import htmlTextClassic from './MiniMapV2.classic.html?raw';
import cssText from './MiniMapV2.css?raw';
import cssTextClassic from './MiniMapV2.classic.css?raw';
import { createMiniMap } from '../MiniMapCommon.js';

export default createMiniMap({
	name: 'MiniMapV2',
	htmlText,
	cssText,
	htmlTextClassic,
	cssTextClassic,
	worldMap: WorldMap,
	townInfoToggle: true,
	coordinates: true,
	arrowShadow: true
});
