// SPDX-License-Identifier: GPL-3.0-only
import { saveOrRestorePlayer1Shields } from "./saveOrRestorePlayer1Shields.js";

/**
 * restorePlayer1Shields — repaint player 1's four bunker shields from their backup buffer.
 *
 * WHAT IT IS
 *   Runs the shared player-1 shield body in RESTORE mode: OR-blits the four saved shield rectangles
 *   from PLAYER1_SHIELD_BUFFER back onto the screen. It does this by forcing the save/restore mode
 *   flag to 0 (restore) and delegating.
 *
 * ROLE IN THE MACHINE
 *   Each player owns a backup buffer for the four bunker shields so bunker damage persists across the
 *   turn hand-off (see mechanisms.md "Shields"). drawOrSaveShields is the common four-block body; the
 *   direction is fixed by which public entry calls it. This entry is the player-1 RESTORE door: its
 *   0 argument becomes SHIELD_SAVE_RESTORE_MODE, which the shared body reads on each of its four
 *   blocks to choose OR-merge-back (restore) over capture (save). saveOrRestorePlayer1Shields seats
 *   DE at PLAYER1_SHIELD_BUFFER (0x2142) before running the body. Fired around round setup / player
 *   switch, when the incoming player's shields are painted back into the field.
 *
 * ROM 0x021a.  Grounding: [seen].
 *
 * LIVE-OUT: memory only (the four shield rectangles OR-blitted back onto the screen).
 */
export function restorePlayer1Shields(m) {
  // 0 = restore mode. The shared body reads it as SHIELD_SAVE_RESTORE_MODE and OR-blits the saved
  // shields back rather than capturing the screen.
  return saveOrRestorePlayer1Shields(m, 0);
}
