// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  OBJECT_AXIS0_FRAC, ENEMY_VEL0_LO, ENEMY_VEL0_HI, ENEMY_SLOT_FLAGS,
  OBJECT_INDEX_TABLE, ENEMY_VEL1_LO, ENEMY_VEL1_HI, OBJECT_AXIS1_POS,
  OBJECT_RECORD_TABLE, ENEMY_VEL2_LO, ENEMY_VEL2_HI, ENEMY_POS2,
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
  const a0 = integrate(mem8, OBJECT_AXIS0_FRAC, ENEMY_VEL0_LO, ENEMY_VEL0_HI, ENEMY_SLOT_FLAGS, x);
  let whole0 = a0.overflow ? 0 : a0.w;

  const a1 = integrate(mem8, OBJECT_INDEX_TABLE, ENEMY_VEL1_LO, ENEMY_VEL1_HI, OBJECT_AXIS1_POS, x);
  if (a1.overflow) whole0 = 0;
  mem8[u16(OBJECT_AXIS1_POS + x)] = a1.w;

  const a2 = integrate(mem8, OBJECT_RECORD_TABLE, ENEMY_VEL2_LO, ENEMY_VEL2_HI, ENEMY_POS2, x);
  if (a2.overflow) whole0 = 0;
  mem8[u16(ENEMY_POS2 + x)] = a2.w;

  mem8[u16(ENEMY_SLOT_FLAGS + x)] = whole0;
  return whole0; // exit Y live-out
}
