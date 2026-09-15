/**
 * UI/Components/PartyFriends/PartyFriendsV1/PartyFriendsV1.js
 *
 * Manage interface for parties and friends (renewal layout)
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import { createPartyFriends } from '../PartyFriendsCommon.js';
import htmlText from './PartyFriendsV1.html?raw';
import htmlTextClassic from './PartyFriendsV1.classic.html?raw';
import cssText from './PartyFriendsV1.css?raw';
import cssTextClassic from './PartyFriendsV1.classic.css?raw';

/**
 * Export
 */
export default createPartyFriends({
	name: 'PartyFriendsV1',
	htmlText,
	cssText,
	htmlTextClassic,
	cssTextClassic,
	renewalParty: true
});
