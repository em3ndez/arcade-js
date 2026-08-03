// SPDX-License-Identifier: GPL-3.0-only
/**
 * restartAttractDemoAt25m — on the timed sub-state advance, reset the live player context to a fresh
 * 25m / level-1 / single-life start and (re)build the board.  ROM 0x0763.
 *
 * One arm of the game-state-1 sub-state dispatch (the 0x0748 table). It is gated by the
 * two-level sub-state timer: each pass ticks the prescaler, and the reset body runs ONLY
 * on the pass where BOTH the fast prescaler and the sub-state counter expire together —
 * the timed advance out of the sub-state, not a per-frame action. Until then the pass
 * does nothing but tick the timer.
 *
 * When the timer expires it:
 *   1. Clears the object-insert request (and a paired engine-scratch byte) to 0.
 *   2. Reseeds the live context: board 1 (25m girders), level 1, one life.
 *   3. Hands off to the board builder to lay out the fresh board — that call's return is
 *      this routine's return.
 *
 * (The two clears in step 1 are faithful to the source but redundant in final RAM: the
 * board builder's 25m setup arm re-clears both bytes. The observable reseeds are the
 * level and life counts, which the builder does not touch.)
 *
 * NAME: promoted from loc_0763 this pass, and the promotion turns on the LIFE COUNT. The
 * fork an earlier header left open — attract-demo restart vs. new-game seed — is decided by
 * the reseed itself: this routine seeds ONE life, and `decodeDipSwitches` unpacks DSW0 into
 * DIP_LIVES = 3, 4, 5 or 6 at *every* DSW setting, with no encoding for 1. A credited game
 * therefore can never enter a board through here, so the round this reset serves is the
 * attract demo's own. `[code]` — the argument is a DIP-decode enumeration, not an
 * observation; what is NOT claimed is anything about the demo's visible content.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0763.test.js.
 * GATE:     captured + crafted. 0x0763 is dispatched every game-state-1 sub-state pass
 *           (~1000 per attract run), so real captured dispatches cover BOTH skip sub-cases
 *           (fast prescaler still counting; fast expired but the sub-state counter still
 *           counting) AND the reset+build path where both expire. Crafted entries preset
 *           the level nonzero so its reseed is observable and force the reset path
 *           deterministically. Compared on RAM − STACK_SCRATCH; the rst-0x20 skip bracket
 *           and the board builder's call/ret churn land in that dead region. Teeth: a
 *           wrong life count, a dropped level reseed, and a gate-not-enforced twin (body
 *           on a skip frame).
 * LIVE-OUT: memory-only. The dispatcher consumes no register from this routine; the
 *           oracle's skip-path caller-skip (a double return) and run-path tail-jump into
 *           the board builder are the dropped stack model, so pc/SP are not part of the
 *           contract.
 * NAMES:    BOARD (0x6227), LIVES (0x6228), LEVEL (0x6229), EVENT_REQ_313C (0x63a0) —
 *           from ram.js. 0x6392 is unnamed engine scratch (ram.js rejects the 0x63xx
 *           scratch band) cleared alongside the object-insert request; kept hex.
 *           tickSubstatePrescaler (ROM 0x0020) and buildBoard (ROM 0x0C92) are imported
 *           and called directly.
 */

import { BOARD, LIVES, LEVEL, EVENT_REQ_313C } from "./ram.js";
import { tickSubstatePrescaler } from "./tickSubstatePrescaler.js"; // ROM 0x0020 (rst 0x20)
import { buildBoard } from "./buildBoard.js"; // ROM 0x0C92

export function restartAttractDemoAt25m(m) {
  const { mem } = m;

  // Timed gate: tick the sub-state timer and run the reset only on the pass where both
  // its prescaler and its counter expire together; otherwise this pass is done.
  if (!tickSubstatePrescaler(m)) return;

  // Clear the object-insert request and the paired engine-scratch byte.
  mem.write8(0x6392, 0); // unnamed engine scratch (no ram.js name yet)
  mem.write8(EVENT_REQ_313C, 0);

  // Reseed the live context: 25m girders, level 1, one life.
  mem.write8(BOARD, 1);
  mem.write8(LEVEL, 1);
  mem.write8(LIVES, 1);

  // Build the fresh board; its return is this routine's return.
  buildBoard(m);
}
