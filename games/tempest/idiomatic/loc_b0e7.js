// SPDX-License-Identifier: GPL-3.0-only
import { loc_0, loc_1, loc_2, loc_4, loc_14d, loc_14e } from "./names.js";

// Seed six work-RAM cells with fixed startup constants.
export function loc_b0e7(m) {
  const { mem8 } = m;
  mem8[loc_0] = 0x0a;
  mem8[loc_2] = 0x00;
  mem8[loc_4] = 0xdf;
  mem8[loc_1] = 0x12;
  mem8[loc_14e] = 0x19;
  mem8[loc_14d] = 0x18;
  return;
}
