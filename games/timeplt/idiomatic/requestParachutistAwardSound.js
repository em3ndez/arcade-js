// SPDX-License-Identifier: GPL-3.0-only
/** requestParachutistAwardSound — request one particular sound, and only while a game is in progress. Its code is
 * fetched from a byte of the program image. LIVE-OUT: memory.
 *
 * ROM 0x57FF-0x5804 (frozen lift loc_57ff). Grounding: [seen] (names.js ROUTINES 0x57FF).
 *
 * Role in the machine: the rescue sound. When the player touches a parachutist its state becomes
 * 0xF0; on its next turn showParachutistAward re-stamps it to 0x3B, asks for this sound, and shows
 * the award shape chosen by PARACHUTIST_RUNG (mechanisms.md).
 *
 * The code is PARACHUTIST_AWARD_SOUND (0x079B), a byte of the program ROM read as data, not an
 * immediate operand. It goes through enqueueSoundIfGameInProgress, so it is queued only while
 * PLAY_ACTIVE is set.
 */

import { enqueueSoundIfGameInProgress } from "./enqueueSoundIfGameInProgress.js";
import { PARACHUTIST_AWARD_SOUND } from "./names.js";

export function requestParachutistAwardSound(m) {
  /* ld a,(0x079b) / jp 0x560c: fetch the code and tail-jump into the in-play gate, whose return
   * goes straight back to our caller. */
  enqueueSoundIfGameInProgress(m, m.mem8[PARACHUTIST_AWARD_SOUND]);
}
