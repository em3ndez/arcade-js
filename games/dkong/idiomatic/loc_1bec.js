// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1bec — advance the airborne player one frame along his arc, then run the airborne handler.
 *
 * The join point where the airborne block's two horizontal-clamp arms meet: reached only after
 * Mario's drift was clamped at a screen edge (the "bounced off the boundary, now finish the frame"
 * path), not the ordinary airborne frame that reaches the handler directly. The handler's return
 * value is propagated so a caller-skip decided further down cannot be swallowed here.
 */

import { stepBallisticMotion } from "./stepBallisticMotion.js";
import { loc_1c05 } from "./loc_1c05.js";

export function loc_1bec(m, ix = m.regs.ix) {
  stepBallisticMotion(m, ix);

  return loc_1c05(m);
}
