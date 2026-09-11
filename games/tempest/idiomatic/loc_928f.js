// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_a6, loc_135, loc_2d3 } from "./names.js";

// Reset leaf: zero a 12-byte block and two flag cells to their baseline.
export function loc_928f(m) {
  const { mem8 } = m;
  // Clear the 12-byte array.
  for (let x = 0x0b; x >= 0; x--) mem8[u16(loc_2d3 + x)] = 0x00;
  // Clear the two associated flag cells.
  mem8[loc_135] = 0x00;
  mem8[loc_a6] = 0x00;
}
