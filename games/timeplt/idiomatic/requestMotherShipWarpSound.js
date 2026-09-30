// SPDX-License-Identifier: GPL-3.0-only
/** requestMotherShipWarpSound — request one particular sound, and only while a game is in progress. Its code is
 * fetched from a byte of the program image. LIVE-OUT: memory.
 *
 * ROM 0x580B-0x5810 (frozen lift loc_580b). Grounding: [seen] (names.js ROUTINES 0x580B).
 *
 * Role in the machine: the warp sound. loc_43f0 asks for it (mechanisms.md places the
 * request in the sweep that follows the Mother-Ship's destruction) and
 * setUpTwoPlayerStartObjectOnce asks for it too; both callers first check that PLAYER_STATE reads
 * 0xFF, i.e. the player is alive.
 *
 * The code is MOTHER_SHIP_WARP_SOUND (0x49EE), a byte of the program ROM read as data, not an
 * immediate operand. It goes through enqueueSoundIfGameInProgress, so it is queued only while
 * PLAY_ACTIVE is set.
 */

import { enqueueSoundIfGameInProgress } from "./enqueueSoundIfGameInProgress.js";
import { MOTHER_SHIP_WARP_SOUND } from "./names.js";

export function requestMotherShipWarpSound(m) {
  /* ld a,(0x49ee) / jp 0x560c: fetch the code and tail-jump into the in-play gate, whose return
   * goes straight back to our caller. */
  enqueueSoundIfGameInProgress(m, m.mem8[MOTHER_SHIP_WARP_SOUND]);
}
