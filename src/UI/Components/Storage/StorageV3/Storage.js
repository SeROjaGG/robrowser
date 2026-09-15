/**
 * UI/Components/Storage/StorageV3/Storage.js
 *
 * Account Storage (Expanded)
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */

import { createStorage } from '../StorageCommon.js';
import StorageFilter from './StorageFilter.js';
import htmlText from './Storage.html?raw';
import htmlTextClassic from './Storage.classic.html?raw';
import cssText from './Storage.css?raw';
import cssTextClassic from './Storage.classic.css?raw';

export default createStorage({
	name: 'Storage',
	htmlText,
	cssText,
	htmlTextClassic,
	cssTextClassic,
	StorageFilter,
	hasFilters: true,
	hasSearch: true,
	hasOrderBy: true
});
