// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  loc_223, loc_2e3, loc_343, loc_283,
  loc_203, loc_2c3, loc_323, loc_263,
  loc_243, loc_303, loc_363, loc_2a3,
} from "./names.js";

// Integrate slot x's three motion axes: each axis folds a low/whole velocity
// pair into a fraction+whole coordinate, resetting the whole on ring overflow
// (>= 0xf0 for a rising axis, < 0x10 for a falling one). Axis 0's whole lands in
// the shared cell only at the end and is also forced to 0 if axis 1 or 2 overflows.
// Returns the axis-0 whole (the value stored to the shared coordinate cell), forced to
// 0 on any axis's ring overflow, as a register live-out.
function integrate(mem8, frac, vlow, sign, whole, x) {
  const sum = mem8[u16(frac + x)] + mem8[u16(vlow + x)];
  mem8[u16(frac + x)] = sum;
  const s = mem8[u16(sign + x)];
  const w = (s + mem8[u16(whole + x)] + (sum > 0xff ? 1 : 0)) & 0xff;
  const overflow = (s & 0x80) ? w < 0x10 : w >= 0xf0;
  return { w, overflow };
}

export function loc_a6a9(m, x = m.regs.x) {
  const { mem8 } = m;
  const a0 = integrate(mem8, loc_223, loc_2e3, loc_343, loc_283, x);
  let whole0 = a0.overflow ? 0 : a0.w;

  const a1 = integrate(mem8, loc_203, loc_2c3, loc_323, loc_263, x);
  if (a1.overflow) whole0 = 0;
  mem8[u16(loc_263 + x)] = a1.w;

  const a2 = integrate(mem8, loc_243, loc_303, loc_363, loc_2a3, x);
  if (a2.overflow) whole0 = 0;
  mem8[u16(loc_2a3 + x)] = a2.w;

  mem8[u16(loc_283 + x)] = whole0;
  return whole0; // exit Y live-out
}
