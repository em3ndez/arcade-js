// SPDX-License-Identifier: GPL-3.0-only
/**
 * triggerMarioFall — request that Mario begin falling because the ground under him
 * went away.
 *
 * Reached from the slope/ledge contact check on the branches that find no girder under
 * Mario's foot. Its whole job is to raise the one-shot "start falling" trigger. The
 * player-state reset picks the trigger up on the next frame: it puts Mario airborne with
 * zero initial velocity, snapshots his height, and clears the trigger — so this single
 * flag is what actually launches the fall.
 *
 * A LEAF: one memory write, no callees, no return value. The value written is fixed and
 * does not depend on anything the routine reads.
 *
 * LIVE-OUT: memory-only — MARIO_START_FALL. The caller tail-invokes this and consumes
 * nothing it leaves behind.
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
