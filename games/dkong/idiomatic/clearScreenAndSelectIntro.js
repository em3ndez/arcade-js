// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearScreenAndSelectIntro — clear the screen and route the board-start sequence
 * into the opening intro cutscene, or skip past it.
 *
 * Sub-state 6 of the credited game's sub-state table, dispatched once per frame on
 * GAME_SUBSTATE. It is the board-start step that wipes the previous scene and decides
 * whether the opening Kong-climb cutscene plays. Four actions, all on fixed memory — it
 * reads no register:
 *
 *   0. GATE. It opens with the shared sub-state timer tick: the timer is ticked every
 *      frame this sub-state is dispatched, and the body runs only on the frame it
 *      reaches 0. While the timer is still counting down the whole routine is skipped.
 *   1. CLEAR. The shared screen wipe blanks the tilemap playfield, the two side columns,
 *      and the 384-byte sprite shadow buffer, ready for the next draw.
 *   2. RE-ARM. SUBSTATE_TIMER is reloaded to 1, so the sub-state selected next proceeds
 *      on the very next frame.
 *   3. ADVANCE. GAME_SUBSTATE is stepped forward: +1 to the opening intro cutscene
 *      (sub-state 7), or a SECOND +1 straight past it to the "how high can you get?"
 *      interlude (sub-state 8) when PLAY_INTRO is clear — which is why a board replayed
 *      after a death skips the intro (both death handlers zero PLAY_INTRO).
 *
 * LIVE-OUT: memory-only — SUBSTATE_TIMER (ticked, then re-armed), GAME_SUBSTATE (advanced
 * by 1 or 2), and the cleared tilemap / sprite-buffer bytes.
 */

import { SUBSTATE_TIMER, GAME_SUBSTATE, PLAY_INTRO } from "./names.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { clearPlayfieldAndSprites } from "./clearPlayfieldAndSprites.js";

export function clearScreenAndSelectIntro(m) {
  const { mem } = m;

  // 0. Timer gate: tick the sub-state timer; run the body only on the frame it
  //    expires. While it is still counting down, skip the whole routine.
  if (!tickSubstateTimer(m)) return;

  // 1. Blank the playfield + sprite shadow buffer for the sub-state about to be entered.
  clearPlayfieldAndSprites(m);

  // 2. Re-arm the timer to 1 so the next sub-state proceeds on the following frame.
  mem.write8(SUBSTATE_TIMER, 0x01);

  // 3. Advance to the opening intro cutscene (sub-state 7)...
  mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) + 1) & 0xff);
  // ...or, when the intro is disabled (a post-death board replay), skip it with a
  //    second advance, straight to the "how high?" interlude (sub-state 8).
  if (mem.read8(PLAY_INTRO) === 0) {
    mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) + 1) & 0xff);
  }
}
