// SPDX-License-Identifier: GPL-3.0-only
import { saveOrRestorePlayer2Shields } from "./saveOrRestorePlayer2Shields.js";

/**
 * savePlayer2Shields — capture player 2's four bunker shields into their backup buffer.
 *
 * WHAT IT IS
 *   Runs the shared player-2 shield body in SAVE mode: captures the four on-screen shield rectangles
 *   into PLAYER2_SHIELD_BUFFER. It does this by forcing the save/restore mode flag to 1 (save) and
 *   delegating.
 *
 * ROLE IN THE MACHINE
 *   Each player keeps a backup of the four bunkers so their damage persists across the turn hand-off
 *   (see mechanisms.md "Shields"). drawOrSaveShields is the common four-block body; the direction is
 *   fixed by the entry. This is the player-2 SAVE door: its 1 argument becomes SHIELD_SAVE_RESTORE_MODE,
 *   which the body reads per block to choose capture-from-screen (save) over OR-merge-back (restore).
 *   saveOrRestorePlayer2Shields seats DE at PLAYER2_SHIELD_BUFFER (0x2242) before running the body.
 *   Fired around player switch, when the outgoing player-2's bunker state is stashed before player 1's
 *   is painted back.
 *
 * ROM 0x020e.  Grounding: [seen].
 *
 * LIVE-OUT: memory only (the four shield rectangles captured into PLAYER2_SHIELD_BUFFER).
 */
export function savePlayer2Shields(m) {
  // 1 = save mode. The shared body reads it as SHIELD_SAVE_RESTORE_MODE and captures the screen
  // rectangles into the buffer rather than blitting the buffer back.
  saveOrRestorePlayer2Shields(m, 1);
}
