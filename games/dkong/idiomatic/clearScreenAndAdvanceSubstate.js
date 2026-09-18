// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearScreenAndAdvanceSubstate — wipe the playfield and sprite buffer, then
 * step GAME_SUBSTATE to the next sub-state (8-bit wrap).
 *
 * LIVE-OUT: memory-only — the cleared display bytes and the incremented GAME_SUBSTATE.
 */

import { GAME_SUBSTATE } from "./names.js";
import { clearPlayfieldAndSprites } from "./clearPlayfieldAndSprites.js";

export function clearScreenAndAdvanceSubstate(m) {
  const { mem8 } = m;

  clearPlayfieldAndSprites(m);

  mem8[GAME_SUBSTATE] = (mem8[GAME_SUBSTATE] + 1);
}
