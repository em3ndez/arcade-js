// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickTimedBoardBonus — run the timed-bonus clock down once per frame on the boards that use one.
 * A per-board gate opens on 50m/75m/100m (closed on 25m, which paces its bonus from barrel
 * releases). An inner tick counts one per frame; when a period elapses it posts that period's
 * deferred work — a board-object spawn request and a task-ring message — reloads from the board's
 * period length, and drops the on-screen bonus by one. When the bonus reaches zero it starts the
 * bonus-expired sequence. Both countdowns test AFTER the decrement.
 *
 * LIVE-OUT: memory-only — the two countdowns, the spawn request, the posted task, and on the last
 * period the bonus-expired step.
 */

import { boardBitGate } from "./boardBitGate.js";
import { enqueueTask } from "./enqueueTask.js";
import { BONUS_TICK, BONUS_PERIOD, BONUS, BONUS_EXPIRED_STEP, SPAWN_REQUEST } from "./names.js";

export function tickTimedBoardBonus(m) {
  const { mem8 } = m;

  // Mask has boards 2/3/4 set: opens on 50m/75m/100m, closed on 25m.
  if (!boardBitGate(m, 0x0e)) return;

  const tick = mem8[BONUS_TICK] - 1;
  mem8[BONUS_TICK] = tick;
  if (tick !== 0) return;

  // Period elapsed: post the spawn request in the two cells that carry it together, enqueue a task.
  mem8[0x62b9] = 3; // bookkeeping byte that moves with the spawn request
  mem8[SPAWN_REQUEST] = 3;
  enqueueTask(m, 0x05, 0x01);

  mem8[BONUS_TICK] = mem8[BONUS_PERIOD];

  const bonus = mem8[BONUS] - 1;
  mem8[BONUS] = bonus;
  if (bonus !== 0) return;

  mem8[BONUS_EXPIRED_STEP] = 1;
}
