// SPDX-License-Identifier: GPL-3.0-only
import { saveOrRestorePlayer1Shields } from "./saveOrRestorePlayer1Shields.js";

/**
 * savePlayer1Shields — capture player 1's four bunker shields into their backup buffer.
 *
 * WHAT IT IS
 *   Forces the shield subsystem into "save" mode and captures the current on-screen state of player 1's
 *   four bunker shields into player 1's backup buffer, so their exact bunker damage can be repainted when
 *   player 1's turn comes around again.
 *
 * ROLE IN THE MACHINE
 *   Each player keeps their own shield-damage backup: PLAYER1_SHIELD_BUFFER (0x2142) lives inside player
 *   1's 0x21xx page. This passes mode = 1 (save) to saveOrRestorePlayer1Shields (0x021b), which seats DE
 *   at that buffer base and runs the shared four-block body drawOrSaveShields (0x021e): mode 1 makes each
 *   0x16-column-by-two-byte block be captured off the screen into the buffer (the restore twin,
 *   restorePlayer1Shields, passes mode 0 to OR-blit them back). Fired around the player switch / round
 *   setup so bunker damage persists across turns.
 *
 * ROM 0x0209-0x020d.  Grounding: [seen].
 *
 * LIVE-OUT: none exposed here (memory-only: the four shield blocks are written into the backup buffer).
 */
export function savePlayer1Shields(m) {
  // Mode 1 = save: capture the four on-screen player-1 shields into PLAYER1_SHIELD_BUFFER.
  saveOrRestorePlayer1Shields(m, 1);
}
