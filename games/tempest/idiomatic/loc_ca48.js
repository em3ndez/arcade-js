// SPDX-License-Identifier: GPL-3.0-only
import { loc_117, loc_3d, VG_MODE_FLAG, VG_SCALE } from "./names.js";

// Set bit 2 of a flag byte, and its paired count byte, from two zero-page gates.
export function loc_ca48(m) {
  const { mem8 } = m;
  let a = 0x00, y = 0x10;
  // Both gates open selects the alternate pair.
  if (mem8[loc_117] !== 0 && mem8[loc_3d] !== 0) {
    a = 0x04;
    y = 0x08;
  }
  // Copy bit 2 of the chosen value into the flag, preserving the rest.
  const cur = mem8[VG_MODE_FLAG];
  mem8[VG_MODE_FLAG] = ((((a ^ cur) & 0x04) ^ cur));
  mem8[VG_SCALE] = y;
}
