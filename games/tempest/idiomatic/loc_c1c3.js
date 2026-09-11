// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_78, loc_80, loc_81, loc_88, loc_90, loc_91,
  loc_6080, loc_6081, loc_6083, loc_6084, loc_6085, loc_6086, loc_6087,
  loc_6089, loc_608c, loc_608d, loc_608e, loc_608f, loc_6090,
} from "./names.js";

// Clear a set of zero-page work cells and math-coprocessor input registers, then set one control register.
export function loc_c1c3(m) {
  const { mem8 } = m;
  mem8[loc_81] = 0;
  mem8[loc_91] = 0;
  mem8[loc_80] = 0;
  mem8[loc_78] = 0;
  mem8[loc_90] = 0;
  mem8[loc_88] = 0;
  mem8[loc_6080] = 0;
  mem8[loc_6081] = 0;
  mem8[loc_6084] = 0;
  mem8[loc_6085] = 0;
  mem8[loc_6086] = 0;
  mem8[loc_6087] = 0;
  mem8[loc_6089] = 0;
  mem8[loc_6083] = 0;
  mem8[loc_608d] = 0;
  mem8[loc_608e] = 0;
  mem8[loc_608f] = 0;
  mem8[loc_6090] = 0;
  mem8[loc_608c] = 0x0f;
}
