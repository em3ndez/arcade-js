// SPDX-License-Identifier: GPL-3.0-only
/**
 * triggerMarioFall — request that Mario begin falling because the ground under him
 * went away.  ROM 0x2ACD.
 *
 * Reached from the slope/ledge contact cascade (decideSlopeGirderFooting) on the branches that find no
 * girder under Mario's foot. Its whole job is to raise the one-shot "start falling"
 * trigger. The player-state reset picks the trigger up on the next frame: it puts Mario
 * airborne with zero initial velocity, snapshots his height, and clears the trigger — so
 * this single flag is what actually launches the fall.
 *
 * A LEAF: one memory write, no callees, no return value. The write value is fixed and
 * does not depend on anything the routine reads.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2acd.test.js.
 * GATE:     exhaustive. The routine ignores all input and always writes the same value,
 *           so the gate sweeps the trigger's prior byte over all 256 values (with and
 *           without surrounding-RAM noise) and confirms the write lands and nothing else
 *           moves, backed by the real captured 0x2ACD dispatches an attract run produces.
 * LIVE-OUT: memory-only (MARIO_START_FALL). The oracle's residual register and its
 *           terminal return are dead — the caller tail-invokes this and consumes no value.
 * NAMES:    MARIO_START_FALL (0x6221) — from names.js.
 */

import { MARIO_START_FALL } from "./names.js";

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {void}
 */
export function triggerMarioFall(m) {
  const { mem } = m;

  // Raise the one-shot "the ground went away — start falling" trigger. The player-state
  // reset consumes and clears it next frame, launching the fall with zero initial velocity.
  mem.write8(MARIO_START_FALL, 1);
}
