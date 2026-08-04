// SPDX-License-Identifier: GPL-3.0-only
/**
 * restartAttractDemoAt25m — on the timed sub-state advance, reset the live player context to a
 * fresh 25m / level-1 / single-life start and (re)build the board.
 *
 * It is gated by the two-level sub-state timer: each pass ticks the prescaler, and the reset
 * body runs ONLY on the pass where both the fast prescaler and the sub-state counter expire
 * together. So this is the timed advance out of a sub-state, not a per-frame action; until the
 * timer expires the pass does nothing but tick it.
 *
 * When it does expire:
 *   1. Clear the object-insert request, and a paired engine-scratch byte, to 0.
 *   2. Reseed the live context: board 1 (25m girders), level 1, one life.
 *   3. Hand off to the board builder to lay out the fresh board — that call's return is this
 *      routine's return.
 *
 * The two clears in step 1 make no difference to final memory: the board builder's 25m setup
 * arm clears both bytes again. The reseeds that survive the build are the level and life
 * counts, which the builder does not touch.
 *
 * ONE LIFE is the detail that names this routine. No dip-switch setting produces a starting
 * life count of one — the decoded settings are three, four, five and six — so a credited game
 * can never enter a board through here, and the round this reset serves is the attract demo's
 * own. That argument is an enumeration of the dip settings, not an observation; nothing here
 * claims anything about what the demo then shows.
 *
 * LIVE-OUT: memory-only.
 */
import { BOARD, LIVES, LEVEL, EVENT_REQ_313C } from "./names.js";
import { tickSubstatePrescaler } from "./tickSubstatePrescaler.js";
import { buildBoard } from "./buildBoard.js";

export function restartAttractDemoAt25m(m) {
  const { mem } = m;

  // Timed gate: tick the sub-state timer and run the reset only on the pass where both
  // its prescaler and its counter expire together; otherwise this pass is done.
  if (!tickSubstatePrescaler(m)) return;

  // Clear the object-insert request and the paired engine-scratch byte.
  mem.write8(0x6392, 0); // engine scratch, carrying no shared name
  mem.write8(EVENT_REQ_313C, 0);

  // Reseed the live context: 25m girders, level 1, one life.
  mem.write8(BOARD, 1);
  mem.write8(LEVEL, 1);
  mem.write8(LIVES, 1);

  // Build the fresh board; its return is this routine's return.
  buildBoard(m);
}
