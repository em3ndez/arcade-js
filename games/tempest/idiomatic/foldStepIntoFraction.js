// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { SPINNER_ACCUM, RIM_ROT_OFFSET } from "./names.js";

// Fold a signed step (times eight) into the low cell, carry its sign up into A, clear the step.
export function foldStepIntoFraction(m, a = m.regs.a) {
  const { mem8 } = m;
  const step = mem8[SPINNER_ACCUM];
  const fold = ((step << 3) & 0xff) + mem8[RIM_ROT_OFFSET];
  mem8[RIM_ROT_OFFSET] = fold;
  const carry = fold > 0xff ? 1 : 0;
  // A negative step sign-extends to 0xff as the high byte added into A.
  const hi = (step & 0x80) !== 0 ? 0xff : 0x00;
  mem8[SPINNER_ACCUM] = 0;
  return (m.regs.a = u8(a + hi + carry));
}
