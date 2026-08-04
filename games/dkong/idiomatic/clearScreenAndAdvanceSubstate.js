// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearScreenAndAdvanceSubstate — wipe the screen, then step to the next sub-state of the current
 * game state.
 *
 * The "blank the screen and move on" step of a sub-state sequence. Two actions, no inputs:
 *
 *   1. CLEAR. Blank the tilemap playfield, the two side columns, and the sprite shadow buffer,
 *      readying the display for whatever the next sub-state draws.
 *   2. ADVANCE. Add one to GAME_SUBSTATE (8-bit wrap), so the next dispatch selects the following
 *      sub-state.
 *
 * It reads no register and no input byte; both effects land on fixed memory.
 *
 * LIVE-OUT: memory-only — the cleared display bytes and the incremented GAME_SUBSTATE.
 */

import { GAME_SUBSTATE } from "./names.js";
import { clearPlayfieldAndSprites } from "./clearPlayfieldAndSprites.js";

export function clearScreenAndAdvanceSubstate(m) {
  const { mem } = m;

  // 1. Blank the playfield + sprite buffer for the next sub-state's draw.
  clearPlayfieldAndSprites(m);

  // 2. Advance the sub-state index (8-bit wrap).
  mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) + 1) & 0xff);
}
