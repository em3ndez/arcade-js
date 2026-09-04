// SPDX-License-Identifier: GPL-3.0-only
import { typeDrawScript } from "./typeDrawScript.js";
import { loc_1dcf } from "./names.js";

/**
 * typeSecondDrawScript — play the second attract-screen draw script.
 *
 * WHAT IT IS
 *   Points the general draw-script walker at the ROM script starting at loc_1dcf (0x1dcf) and walks
 *   it. A "draw script" is a table of 4-byte records (a destination word and a source word) ending in
 *   a 0xff terminator; typeDrawScript fetches each record and types it to the screen. This is the tail
 *   of the attract score-advance display: the callers paint the header/column material first, then run
 *   this script to lay down the second block of the attract layout.
 *
 * ROLE IN THE MACHINE
 *   Tail-called from drawScoreAdvanceTable (0x1815), which draws the score-advance header string and
 *   the SCORE_ADVANCE_DRAW_SCRIPT column script and then falls into this routine. A thin wrapper over typeDrawScript
 *   (0x183a); its only job is to seat the script pointer at loc_1dcf. A generator because typeDrawScript
 *   yields as it paces the typed output. loc_1dcf keeps a placeholder name — it is the ROM draw-script
 *   data block. Memory-only (writes video RAM).
 *
 * ROM 0x1837.  Grounding: [seen] (script data cell loc_1dcf role open).
 *
 * LIVE-OUT: none for callers beyond the video-RAM writes; runs to the 0xff terminator.
 */
export function* typeSecondDrawScript(m) {
  // Seat the walker at the second attract draw script (loc_1dcf) and run it to its 0xff terminator.
  yield* typeDrawScript(m, loc_1dcf);
}
