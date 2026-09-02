// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { countStepsToThreshold } from "./countStepsToThreshold.js";
import { loc_200a } from "./names.js";

// Scale the object's Y cell toward the threshold in H: the step count lands in C and the leftover residual in H/A.
export function loc_156f(m, h = m.regs.h) {
  const [stepped] = countStepsToThreshold(m, m.mem8[loc_200a], h);
  const residual = u8(stepped - 0x10);
  return [(m.regs.a = residual), (m.regs.h = residual)];
}
