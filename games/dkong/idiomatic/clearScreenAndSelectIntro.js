// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearScreenAndSelectIntro — sub-state 6 of the in-game sub-state table: gate on the shared
 * sub-state timer, then on the frame it expires clear the playfield and sprite buffer, re-arm the
 * timer to 1, and advance GAME_SUBSTATE — by 1 into the opening intro cutscene, or by 2 straight
 * past it to the "how high?" interlude when PLAY_INTRO is clear (a post-death board replay).
 *
 * LIVE-OUT: memory-only — SUBSTATE_TIMER, GAME_SUBSTATE, and the cleared tilemap/sprite bytes.
 */

import { SUBSTATE_TIMER, GAME_SUBSTATE, PLAY_INTRO } from "./names.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { clearPlayfieldAndSprites } from "./clearPlayfieldAndSprites.js";

export function clearScreenAndSelectIntro(m) {
  const { mem8 } = m;

  if (!tickSubstateTimer(m)) return;

  clearPlayfieldAndSprites(m);

  mem8[SUBSTATE_TIMER] = 0x01;

  mem8[GAME_SUBSTATE] = mem8[GAME_SUBSTATE] + 1;
  if (mem8[PLAY_INTRO] === 0) {
    mem8[GAME_SUBSTATE] = mem8[GAME_SUBSTATE] + 1;
  }
}
