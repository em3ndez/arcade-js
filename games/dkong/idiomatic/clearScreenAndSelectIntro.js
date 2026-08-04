// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearScreenAndSelectIntro — clear the screen and route the board-start sequence
 * into the opening intro cutscene, or skip past it.  ROM 0x0a63.
 *
 * Sub-state 6 of the credited-game (GAME_STATE 3) sub-state table at ROM 0x0702,
 * dispatched by dispatchInGameSubstate (loc_06fe) on GAME_SUBSTATE (0x600A). It is
 * the board-start step that wipes the previous scene and decides whether the opening
 * Kong-climb cutscene plays. Four actions, all on fixed memory — it reads no register:
 *
 *   0. GATE. It opens with the rst-0x18 sub-state timer (tickSubstateTimer): the timer
 *      is ticked every frame this sub-state is dispatched, and the body runs only on
 *      the frame it reaches 0. While the timer is still counting down the whole routine
 *      is skipped — the Z80 caller-skip idiom, here a plain early return.
 *   1. CLEAR. clearPlayfieldAndSprites (ROM 0x0874) blanks the tilemap playfield, the
 *      two side columns, and the 384-byte sprite shadow buffer for the next draw.
 *   2. RE-ARM. SUBSTATE_TIMER (0x6009) is reloaded to 1, so the sub-state selected next
 *      proceeds on the very next frame.
 *   3. ADVANCE. GAME_SUBSTATE (0x600A) is stepped forward: +1 to the opening intro
 *      cutscene (sub-state 7, ROM 0x0a76), or a SECOND +1 straight past it to the
 *      "how high can you get?" interlude (sub-state 8, ROM 0x0bda) when PLAY_INTRO
 *      (0x622C) is clear — which is why a board replayed after a death skips the intro
 *      (both death handlers zero PLAY_INTRO).
 *
 * Memory-equivalent to the frozen oracle — equivalence-0a63.test.js.
 * GATE:     crafted-entry; reached once in a coin+start driven run (state-3 sub-state 6,
 *           timer expired, PLAY_INTRO set -> advance to the intro) as a real dispatch,
 *           plus crafted sentinel entries sweeping {timer expired / still ticking} x
 *           {PLAY_INTRO == 0 / != 0} and the GAME_SUBSTATE 8-bit wrap edge, with the
 *           clear regions painted to a sentinel on BOTH sides (the routine reads no
 *           register, so those three memory bytes fully determine its behaviour).
 *           Teeth = inverted-intro-branch, missing-timer-gate, and skip-clear.
 * LIVE-OUT: memory-only — SUBSTATE_TIMER (ticked, re-armed), GAME_SUBSTATE (advanced by
 *           1 or 2), and the cleared tilemap / sprite-buffer bytes. No live registers or
 *           flags: the oracle's terminal A/HL/DE/F are dead ABI (the rst-0x28 sub-state
 *           dispatch returns up the NMI path, which consumes none of them). SP/PC are
 *           NOT compared — the idiomatic layer replaces the rst-0x18 caller-skip and the
 *           call/ret stack bookkeeping with the JS call stack and a boolean return.
 * NAMES:    SUBSTATE_TIMER (0x6009), GAME_SUBSTATE (0x600A), PLAY_INTRO (0x622C) — from
 *           names.js.
 */

import { SUBSTATE_TIMER, GAME_SUBSTATE, PLAY_INTRO } from "./names.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { clearPlayfieldAndSprites } from "./clearPlayfieldAndSprites.js";

export function clearScreenAndSelectIntro(m) {
  const { mem } = m;

  // 0. rst-0x18 gate: tick the sub-state timer; run the body only on the frame it
  //    expires. While it is still counting down, skip the whole routine (the oracle's
  //    caller-skip, folded into a plain early return).
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
