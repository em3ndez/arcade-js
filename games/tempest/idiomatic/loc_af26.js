// SPDX-License-Identifier: GPL-3.0-only
import { loc_600, loc_601 } from "./names.js";
import { loc_af6e } from "./loc_af6e.js";
import { loc_ab14 } from "./loc_ab14.js";
import { loc_af71 } from "./loc_af71.js";
import { loc_af3f } from "./loc_af3f.js";

// When either counter byte is live, draw a shared header, its count, and both counter slots.
export function loc_af26(m) {
  const { mem8 } = m;
  if ((mem8[loc_600] | mem8[loc_601]) === 0) return loc_af6e();
  loc_ab14(m, 0x12);
  loc_af71(m, 0x63);
  loc_af3f(m, 0x00);
  return loc_af3f(m, 0x01);
}
