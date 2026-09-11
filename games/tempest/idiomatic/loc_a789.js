// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_283, loc_10e, loc_10d, loc_1, loc_68, loc_69 } from "./names.js";

// Init leaf: zero the 16-byte per-slot table, then re-seed a few scalar cells to
// their starting values (two to 0x20, one to 0x04, and a pair to 0).
export function loc_a789(m) {
  const { mem8 } = m;
  for (let x = 0x0f; x >= 0; x--) mem8[u16(loc_283 + x)] = 0x00;
  mem8[loc_10e] = 0x20;
  mem8[loc_10d] = 0x20;
  mem8[loc_1] = 0x04;
  mem8[loc_68] = 0x00;
  mem8[loc_69] = 0x00;
}
