// SPDX-License-Identifier: GPL-3.0-only
import { loc_0, loc_1, loc_2, loc_4 } from "./names.js";

// Seed four config cells with fixed constants for the next state.
export function loc_c97b(m) {
  const { mem8 } = m;
  mem8[loc_2] = 0x04;
  mem8[loc_1] = 0x00;
  mem8[loc_0] = 0x0a;
  mem8[loc_4] = 0x14;
}
