// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickTimedBoardBonus — run the clock down on the boards whose bonus is timed, once per frame.
 *
 * It is a two-level countdown that walks the on-screen bonus down at a fixed cadence, and posts the
 * work each period owes while it goes:
 *
 *   1. A per-board skip gate decides whether this board wants a timed bonus at all. Its mask has
 *      the bits for boards 2, 3 and 4 set, so the gate opens on the 50m conveyor, 75m elevator and
 *      100m rivet boards and closes on 25m, which paces its own bonus from barrel releases instead.
 *      Closed, and the frame does nothing.
 *
 *   2. The inner tick counts down one per frame. Until it hits zero the current bonus period is
 *      still running and there is nothing more to do.
 *
 *   3. When a period elapses it posts that period's deferred work — a board-object spawn request,
 *      written to two cells that move in lockstep, plus a task-ring message — and reloads the inner
 *      tick from the board's configured period length.
 *
 *   4. The outer counter is the bonus the player sees; it drops by one each elapsed period. While
 *      it is still positive the board keeps its bonus.
 *
 *   5. When the bonus reaches zero it kicks off the bonus-expired sequence by setting that
 *      sequence's step to 1.
 *
 * Both countdowns are a read-decrement-write on their own byte, testing the value AFTER the
 * decrement: a non-zero result means that level is still counting and the routine bows out.
 *
 * LIVE-OUT: memory-only — the two countdowns, the spawn request, the posted task, and on the last
 * period the bonus-expired step.
 */

import { boardBitGate } from "./boardBitGate.js";
import { enqueueTask } from "./enqueueTask.js";
import { BONUS_TICK, BONUS_PERIOD, BONUS, BONUS_EXPIRED_STEP, SPAWN_REQUEST } from "./names.js";

export function tickTimedBoardBonus(m) {
  const { regs, mem } = m;

  // Per-board skip gate. The mask has the bits for boards 2/3/4 set, so it opens only on the
  // 50m / 75m / 100m boards and closes on 25m. Closed -> nothing to do.
  regs.a = 0x0e;
  if (!boardBitGate(m)) return;

  // Inner tick: one countdown step per frame. A nonzero result means the current bonus
  // period is still running, so bow out until it elapses.
  const tick = mem.read8(BONUS_TICK) - 1;
  mem.write8(BONUS_TICK, tick);
  if (tick !== 0) return;

  // A bonus period just elapsed. Post its deferred work: request a board-object spawn, in the
  // two cells that carry that request together, and enqueue a task-ring message.
  mem.write8(0x62b9, 3); // the bookkeeping byte that moves with the spawn request
  mem.write8(SPAWN_REQUEST, 3);
  regs.d = 0x05; // task message opcode
  regs.e = 0x01; // task message argument
  enqueueTask(m);

  // Reload the inner tick for the next period from its configured length.
  mem.write8(BONUS_TICK, mem.read8(BONUS_PERIOD));

  // Outer counter: the on-screen bonus, dropped by one per elapsed period. Still positive means
  // the board keeps its bonus, so nothing more this period.
  const bonus = mem.read8(BONUS) - 1;
  mem.write8(BONUS, bonus);
  if (bonus !== 0) return;

  // Bonus exhausted: start the bonus-expired sequence.
  mem.write8(BONUS_EXPIRED_STEP, 1);
}
