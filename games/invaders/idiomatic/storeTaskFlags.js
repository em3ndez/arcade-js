// SPDX-License-Identifier: GPL-3.0-only
import { TASK_FLAGS } from "./names.js";

/**
 * storeTaskFlags — write the per-frame task bitfield.
 *
 * WHAT IT IS
 *   Stores the accumulator into TASK_FLAGS (0x20c1), the one-byte record of which drawing/servicing task
 *   the current frame owes.
 *
 * ROLE IN THE MACHINE
 *   TASK_FLAGS is the per-frame task bitfield the interrupt bodies consult: the mid-screen body rotates
 *   its low bit out and runs its draw pair only when set, and during the attract demo dispatchAttractTask
 *   reads its low three bits to pick exactly one arm (record tail / animation step / attract object walk).
 *   This routine is that cell's writer; callers seat A with the task bits they want armed and store it
 *   here. It is cleared, for instance, at round start (startRoundFlow clears TASK_FLAGS).
 *
 * ROM 0x1982.  Grounding: [seen].
 *
 * LIVE-OUT: memory only (TASK_FLAGS = A); the seam completes the ret.
 */
export function storeTaskFlags(m, a = m.regs.a) {
  // Store A into the per-frame task bitfield cell.
  m.mem8[TASK_FLAGS] = a;
}
