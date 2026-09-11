// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_2df, loc_108, loc_109, loc_145, loc_142, loc_144, loc_143, loc_146 } from "./names.js";

// Reset leaf: zero a 7-byte block and seven scattered flag cells to their baseline.
export function loc_926f(m) {
  const { mem8 } = m;
  // Clear the 7-byte array.
  for (let x = 0x06; x >= 0; x--) mem8[u16(loc_2df + x)] = 0x00;
  // Clear the seven associated flag cells.
  mem8[loc_108] = 0x00;
  mem8[loc_109] = 0x00;
  mem8[loc_145] = 0x00;
  mem8[loc_142] = 0x00;
  mem8[loc_144] = 0x00;
  mem8[loc_143] = 0x00;
  mem8[loc_146] = 0x00;
}
