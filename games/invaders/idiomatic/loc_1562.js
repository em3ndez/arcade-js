// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { countStepsToThreshold } from "./countStepsToThreshold.js";
import { loc_2009 } from "./names.js";

// Scale the object's X cell toward the threshold in L: the step count less one becomes the block index in B, the leftover the residual in L/A.
export function loc_1562(m, l = m.regs.l) {
  const [stepped, count] = countStepsToThreshold(m, m.mem8[loc_2009], l);
  const residual = u8(stepped - 0x10);
  return [(m.regs.a = residual), (m.regs.l = residual), (m.regs.b = u8(count - 1))];
}
