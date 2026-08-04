// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_16d0 — set object #1's countdown to 1 so an even-frame tick reverses the group,
 * then slide it.
 *
 * One of two entry variants of the group-slide tail, in the sub-state family that
 * walks a horizontally-moving group of 10 sprites back and forth. The family's
 * dispatcher runs first every frame: it CLEARS object #1's even-frame countdown
 * (M50_OBJ1_REVERSE_TIMER := 0), reads the group's leading X and the object's step
 * sign, and routes to a tail by whether the group has reached the edge it is currently
 * moving toward. This is the "hit the boundary" arm:
 *
 *   1. Set M50_OBJ1_REVERSE_TIMER := 1, then fall straight into the shared motion
 *      tick, which drives the object's step driver IN THE SAME FRAME. That driver
 *      ticks the countdown only on EVEN frames, and a decrement from 1 gives ZERO,
 *      which is exactly the case it turns into "reload the period (0x80) and REVERSE
 *      the step-direction sign at M50_OBJ1_STEP_DIR". So this is not a schedule for a
 *      later tick:
 *        - Entered on an EVEN frame, the reversal fires in THIS frame's tick. The
 *          flipped direction is consequential downstream: the driver republishes it as
 *          the group's step — 0 on this even frame, then normalised to 0xFF/0x01 by
 *          its new sign on the next odd frame — which is both the amount the shared
 *          tail slides the block by and the byte the dispatcher routes on next frame.
 *        - Entered on an ODD frame, the driver skips the countdown entirely, and next
 *          frame the dispatcher re-clears M50_OBJ1_REVERSE_TIMER to 0 before any arm
 *          runs. So on an odd frame this write is LOST, not deferred.
 *      (The plain arm leaves the countdown at the 0 the dispatcher pre-set; a
 *      decrement from 0 is the genuine underflow, 0 -> 0xFF, and 0xFF is non-zero, so
 *      no reversal is taken and the group keeps travelling.)
 *
 *   2. Fall straight into the shared motion tick to run THIS frame's motion — advance
 *      object #1 and shift the whole 10-record sprite-object block one step along X.
 *
 * The value 1 is dead the instant it is stored (the driver reads the frame counter, not
 * a register), so the store is expressed directly as a memory write with no register
 * plumbing. Not a leaf: it falls into the shared motion tick. Nothing in THIS routine's
 * own state settles what is on screen — it adds only a one-byte reversal-arming write
 * to that shared tail — so it keeps a neutral name and describes the mechanic in prose.
 *
 * LIVE-OUT: memory-only. It tail-returns through the shared motion tick, and the
 * dispatch path above reads no register or flag it leaves.
 */

import { stepKongWalk } from "./stepKongWalk.js"; // the shared group-slide motion tick
import { M50_OBJ1_REVERSE_TIMER } from "./names.js";

export function loc_16d0(m) {
  const { mem } = m;

  // Set object #1's countdown to 1. The shared motion tick below drives the object's
  // step driver in THIS same frame, and on an even frame that driver decrements the
  // countdown: 1 -> 0 is the zero case, so it reloads the period (0x80) and reverses
  // the group's step direction. On an odd frame the driver skips the tick and the
  // dispatcher clears this byte again next frame.
  mem.write8(M50_OBJ1_REVERSE_TIMER, 0x01);

  // Fall through to the shared motion tick (advance object #1, slide the 10-record block).
  stepKongWalk(m);
}
