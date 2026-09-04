// SPDX-License-Identifier: GPL-3.0-only
import { saveOrRestorePlayer2Shields } from "./saveOrRestorePlayer2Shields.js";

/**
 * restorePlayer2Shields (ROM 0x0213) -- paint player 2's saved bunker shields back onto the screen.
 *
 * WHAT IT IS
 *   The "restore" front door for player 2's shields. It forces the shared shield save/restore body into
 *   RESTORE mode by passing 0, which OR-blits player 2's four bunker bitmaps out of PLAYER2_SHIELD_BUFFER
 *   (0x2242) back into video RAM. (Mode 1 would instead CAPTURE the screen into the buffer -- that is the
 *   twin savePlayer2Shields at 0x020e.)
 *
 * ROLE IN THE MACHINE
 *   Because each player owns a shield backup buffer inside their own page, bunker damage persists across
 *   the two-player hand-off: the outgoing player's shields are captured and the incoming player's are
 *   painted back. This restore fires around player 2's round setup. It delegates to
 *   saveOrRestorePlayer2Shields(m, 0), which seats DE at the player-2 buffer base and runs the common
 *   four-block body drawOrSaveShields (which stores the mode into SHIELD_SAVE_RESTORE_MODE and, per block,
 *   OR-merges the buffer onto SHIELD_VRAM_BASE at DRAW_BLOCK_STRIDE spacing when the mode is clear).
 *
 * ROM 0x0213.  Grounding: [seen] (names.js cert for 0x0213).
 *
 * LIVE-OUT: memory only.
 */
// Restore the player-2 shields: force the mode flag clear, then run the shared shield-draw body.
export function restorePlayer2Shields(m) {
  // Mode 0 = restore (OR-blit the buffer back onto the screen); seat player 2's buffer and run the body.
  saveOrRestorePlayer2Shields(m, 0);
}
