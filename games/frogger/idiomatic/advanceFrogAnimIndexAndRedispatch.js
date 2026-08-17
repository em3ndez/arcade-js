// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceFrogAnimIndexAndRedispatch — index step + recursion driver: bump the anim index; while below the
 * arm count re-dispatch the next arm with a direct self-call (no m.call, seam not re-entered), else wrap to
 * 0 and plain-return so the cluster's single net ret lands on the caller's slot. LIVE-OUT: memory-only.
 */
import { loc_8000 } from "./names.js";
import { dispatchFrogAnimationArm } from "./dispatchFrogAnimationArm.js";

const ANIM_ARM_COUNT = 0x0b;

export function advanceFrogAnimIndexAndRedispatch(m) {
  const { mem8 } = m;

  const index = (mem8[loc_8000] + 1) & 0xff;
  mem8[loc_8000] = index;
  if (index < ANIM_ARM_COUNT) return dispatchFrogAnimationArm(m);

  mem8[loc_8000] = 0;
  return;
}
