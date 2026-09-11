// SPDX-License-Identifier: GPL-3.0-only
import { loc_5, loc_3e, loc_2, loc_0, loc_4, loc_16b, loc_1 } from "./names.js";

// Mask one cell to its low six bits, then write a block of fixed init constants.
export function loc_ca18(m) {
  const { mem8 } = m;
  mem8[loc_5] = mem8[loc_5] & 0x3f; // keep only the low six bits
  mem8[loc_3e] = 0x00;
  mem8[loc_2] = 0x1a;
  mem8[loc_0] = 0x0a;
  mem8[loc_4] = 0xa0;
  mem8[loc_16b] = 0x01;
  mem8[loc_1] = 0x0a;
}
