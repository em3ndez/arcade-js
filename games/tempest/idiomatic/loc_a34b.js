// SPDX-License-Identifier: GPL-3.0-only
import { loc_29, loc_2c, loc_2d, loc_13b, loc_13c, loc_200, loc_201, loc_202 } from "./names.js";
import { loc_ccb0 } from "./loc_ccb0.js";
import { loc_a3d6 } from "./loc_a3d6.js";

// Shared insert tail: seat the object's type byte, copy its source and target cells,
// fire the sound gate, insert it into the 8-slot table, then raise the ready flags.
export function loc_a352(m, a = m.regs.a, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  mem8[loc_2c] = a;
  mem8[loc_29] = mem8[loc_202];
  mem8[loc_2d] = mem8[loc_200];
  loc_ccb0(m, x, y);
  loc_a3d6(m, x, y);
  mem8[loc_201] = 0x81;
  mem8[loc_13c] = 0x01;
}

// Seed the head flag with the given value, then insert a type-1 object through the tail.
export function loc_a34d(m, a = m.regs.a, x = m.regs.x, y = m.regs.y) {
  m.mem8[loc_13b] = a;
  return loc_a352(m, 0x01, x, y);
}

// Prime a fresh top-priority object: head flag 0xff, then the type-1 insert.
export function loc_a34b(m, x = m.regs.x, y = m.regs.y) {
  return loc_a34d(m, 0xff, x, y);
}
