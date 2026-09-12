// SPDX-License-Identifier: GPL-3.0-only
import { loc_0, loc_1, loc_5, loc_1c9, loc_1ca, loc_c00 } from "./names.js";
import { loc_abac } from "./loc_abac.js";

// Arm two mode bytes, then rebuild only while idle, enabled, and unbusy.
export function loc_d7e1(m) {
  const { mem8 } = m;
  mem8[loc_5] = 0x00;
  mem8[loc_1] = 0x02;
  if (mem8[loc_1ca] !== 0) return;
  if ((mem8[loc_c00] & 0x10) === 0) return;
  mem8[loc_0] = 0x00;
  if ((mem8[loc_1c9] & 0x03) === 0) return;
  loc_abac(m);
}
