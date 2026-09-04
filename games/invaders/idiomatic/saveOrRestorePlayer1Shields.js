// SPDX-License-Identifier: GPL-3.0-only
import { drawOrSaveShields } from "./drawOrSaveShields.js";
import { PLAYER1_SHIELD_BUFFER } from "./names.js";

/**
 * saveOrRestorePlayer1Shields — run the shared shield save/restore body against player 1's buffer.
 *
 * WHAT IT IS
 *   A thin seater. It points DE at player 1's shield backup buffer PLAYER1_SHIELD_BUFFER (0x2142) and
 *   drops into the common four-block body drawOrSaveShields, which walks the four on-screen bunkers
 *   (each a 0x16-column by 2-byte rectangle) and either SAVES them off the screen or RESTORES them back,
 *   as chosen by the caller's mode byte A.
 *
 * ROLE IN THE MACHINE
 *   The player-1 side of the shield persistence pair (saveOrRestorePlayer2Shields is its twin, seating
 *   0x2242). The mode is not decided here — the four public entries fix it: savePlayer1Shields forces
 *   save (A=1) and restorePlayer1Shields forces restore (A=0), both routing through this seater.
 *   PLAYER1_SHIELD_BUFFER lives inside player 1's own 0x21xx page, so each player's bunker damage
 *   persists across turns; these fire around the player switch and round setup (outgoing player's
 *   shields captured, incoming player's painted back).
 *
 * ROM 0x021b-0x021d.  Grounding: [seen].
 * LIVE-OUT: memory-only (the shield buffer or the on-screen bunkers, per the mode).
 */
// Save or restore the shields against their backup buffer, driven by A as the save/restore mode.
export function saveOrRestorePlayer1Shields(m, a = m.regs.a) {
  // Seat DE at player 1's buffer base and run the shared body; A carries the save(1)/restore(0) mode.
  return drawOrSaveShields(m, a, PLAYER1_SHIELD_BUFFER);
}
