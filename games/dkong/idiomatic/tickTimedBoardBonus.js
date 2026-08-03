// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickTimedBoardBonus — pace the bonus countdown on the timed boards (50m / 75m / 100m).  ROM 0x2FCB.
 *
 * Called once per frame from the shared per-frame update cascade (loc_197a). It runs a
 * two-level countdown that walks the on-screen bonus down at a fixed cadence, and posts
 * the per-period work while it does:
 *
 *   1. A per-board skip gate decides whether this board wants the timed decrementer at
 *      all. The gate mask has the bits for boards 2/3/4 set, so it opens on the 50m
 *      conveyor / 75m elevator / 100m rivet boards and closes on the 25m girder board —
 *      which paces its own bonus from the barrel-release routine instead. Closed → this
 *      frame does nothing.
 *
 *   2. The inner tick counts down once per frame. Until it reaches zero the current bonus
 *      period is still running, so there is nothing more to do this frame.
 *
 *   3. When a period elapses it posts that period's deferred work — a board-object spawn
 *      request (a sibling bookkeeping byte and SPAWN_REQUEST both take 3) plus a task-ring
 *      message — then reloads the inner tick from its configured period length.
 *
 *   4. The outer counter is the actual bonus shown on screen; it drops by one each elapsed
 *      period. While it is still positive the board keeps its bonus.
 *
 *   5. When the bonus reaches zero it kicks off the bonus-expired sequence (the small
 *      state machine dispatched from 0x1A07) by setting its step to 1.
 *
 * Both countdowns are read-decrement-write on their own byte and test the post-decrement
 * value for zero — a nonzero result means the level is still counting and the routine bows
 * out early.
 *
 * NOT a leaf: it runs two already-idiomatic leaves — the per-board skip gate (boardBitGate,
 * ROM 0x0030) and the task-ring post (enqueueTask, ROM 0x309F) — called directly; neither
 * touches the Z80 stack.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2fcb.test.js.
 * GATE:     crafted-entry — attract dispatches this 1197× over 2000 frames but every one is
 *           the 25m demo (BOARD == 1), so real captures only cover the gate-CLOSED arm; the
 *           body arms (period-elapsed spawn/enqueue, bonus-expired) are crafted from a real
 *           booted machine with BOARD / the two countdowns poked, plus an exhaustive BOARD
 *           0..255 sweep pinning the gate branch.
 * LIVE-OUT: memory-only — the caller (loc_197a) reloads its own accumulator from 0x6200
 *           right after the call and consumes no flag, so no register or flag is live out;
 *           the oracle just returns.
 * NAMES:    BONUS_TICK (0x62B4), BONUS_PERIOD (0x62B3), BONUS (0x62B1), BONUS_EXPIRED_STEP
 *           (0x6386), SPAWN_REQUEST (0x6396) from ram.js. 0x62B9 has no ram.js name — a
 *           board-object bookkeeping byte set in lockstep with SPAWN_REQUEST; kept hex.
 */

import { boardBitGate } from "./boardBitGate.js"; // ROM 0x0030 (rst 0x30) — per-board skip gate
import { enqueueTask } from "./enqueueTask.js"; // ROM 0x309F — post a task-ring message
import { BONUS_TICK, BONUS_PERIOD, BONUS, BONUS_EXPIRED_STEP, SPAWN_REQUEST } from "./ram.js";

export function tickTimedBoardBonus(m) {
  const { regs, mem } = m;

  // Per-board skip gate. The mask 0x0E has the bits for boards 2/3/4 set, so the gate
  // opens only on the 50m / 75m / 100m boards and closes on 25m. Closed → nothing to do.
  regs.a = 0x0e;
  if (!boardBitGate(m)) return;

  // Inner tick: one countdown step per frame. A nonzero result means the current bonus
  // period is still running, so bow out until it elapses.
  const tick = mem.read8(BONUS_TICK) - 1;
  mem.write8(BONUS_TICK, tick);
  if (tick !== 0) return;

  // A bonus period just elapsed. Post its deferred work: request a board-object spawn
  // (SPAWN_REQUEST and its bookkeeping sibling both take 3) and enqueue a task-ring
  // message [opcode 5, argument 1].
  mem.write8(0x62b9, 3); // board-object bookkeeping byte (unnamed in ram.js) — set with SPAWN_REQUEST
  mem.write8(SPAWN_REQUEST, 3);
  regs.d = 0x05; // task message opcode
  regs.e = 0x01; // task message argument
  enqueueTask(m);

  // Reload the inner tick for the next period from its configured length.
  mem.write8(BONUS_TICK, mem.read8(BONUS_PERIOD));

  // Outer counter: the on-screen bonus, dropped by one per elapsed period. Still positive
  // → the board keeps its bonus, so nothing more this period.
  const bonus = mem.read8(BONUS) - 1;
  mem.write8(BONUS, bonus);
  if (bonus !== 0) return;

  // Bonus exhausted: start the bonus-expired sequence (the state machine at 0x1A07).
  mem.write8(BONUS_EXPIRED_STEP, 1);
}
