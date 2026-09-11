// SPDX-License-Identifier: GPL-3.0-only
import { loc_127, loc_200 } from "./names.js";
import { loc_adce } from "./loc_adce.js";

// Nudge the stored value by its signed step, then clamp it into the [0, ceiling] window, publishing the
// result to the cell and to the accumulator/index live-outs.
export function loc_b0ab(m) {
  const { mem8 } = m;
  let a = loc_adce(m, mem8[loc_200]);
  if (a >= 0x80) {
    a = 0x00; // negative floors to zero
  } else if (a >= mem8[loc_127]) {
    a = mem8[loc_127]; // clamp to the ceiling
  }
  mem8[loc_200] = a;
  // A and Y are both live-outs (= the clamped value) — both ride the return.
  return [(m.regs.a = a), (m.regs.y = a)];
}
