// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_138f — one-shot timed sub-state transition: wait out the sub-state timer, then jump the
 * game to one of two follow-on sub-states depending on whether player 2 has a game in progress.
 *
 * One of the in-game sub-state handlers, run once per frame while a credited game is going.
 * The shared countdown helper decrements the sub-state timer every frame, and only on the
 * frame that counter reaches zero does the rest of this handler run. On that expiry frame it
 * re-arms the timer to 1 — one frame of grace before the next sub-state takes over — and
 * writes the follow-on sub-state index: the LIVE index when player 2's saved context (his
 * stored life count) is non-zero, the DEAD index otherwise.
 *
 * The whole conditional is that timer gate plus the one non-zero test; nothing else branches.
 * A twin handler is identical but reads player 1's context instead.
 *
 * NOT CLAIMED: what the two follow-on sub-states DO, or why player 2's saved context is what
 * picks between them. The transition itself is what this file establishes.
 *
 * Reads: the sub-state timer (through the countdown helper); player 2's saved context.
 * Writes: the sub-state timer; the game sub-state, on the expiry frame only.
 *
 * LIVE-OUT: memory-only. The dispatcher discards this handler's result.
 */

import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { SUBSTATE_TIMER, GAME_SUBSTATE, P2_CONTEXT } from "./names.js";

// The two follow-on sub-state indices this handler selects between. Kept hex because what
// they mean at the game level is not established here.
const SUBSTATE_P2_LIVE = 0x17; // P2 still has a saved game
const SUBSTATE_P2_DEAD = 0x14; // P2 has none

export function loc_138f(m) {
  const { mem } = m;

  // Tick the sub-state countdown. While it is still counting there is nothing to do yet.
  if (!tickSubstateTimer(m)) return;

  // The timer just hit 0, so re-arm it to 1: one frame of grace before the next sub-state
  // runs.
  mem.write8(SUBSTATE_TIMER, (mem.read8(SUBSTATE_TIMER) + 1) & 0xff);

  // Pick the follow-on sub-state from player 2's saved context.
  const nextSubstate = mem.read8(P2_CONTEXT) !== 0 ? SUBSTATE_P2_LIVE : SUBSTATE_P2_DEAD;
  mem.write8(GAME_SUBSTATE, nextSubstate);
}
