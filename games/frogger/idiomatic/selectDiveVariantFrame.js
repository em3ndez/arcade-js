// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectDiveVariantFrame — even-phase variant of the surface-timer step: point the frame copy at
 * the alternate (arm-0) tile table base and hand off to the shared frame copier.
 */
import { copyDiveAnimFrame } from "./copyDiveAnimFrame.js";
import { FROG_ANIM_ARM0_SRC_BASE } from "./names.js";

export function selectDiveVariantFrame(m) {
  return copyDiveAnimFrame(m, FROG_ANIM_ARM0_SRC_BASE);
}
