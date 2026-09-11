// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_3fe, loc_405, loc_115 } from "./names.js";

// Zero an eight-byte table, then overwrite its last slot with 0xf0 and arm a flag byte to 0xff.
export function loc_a7bd(m) {
  const { mem8 } = m;
  for (let x = 7; x >= 0; x--) mem8[u16(loc_3fe + x)] = 0x00; // zero the table
  mem8[loc_405] = 0xf0; // overwrite the last slot
  mem8[loc_115] = 0xff; // arm the flag
  return;
}
