// SPDX-License-Identifier: GPL-3.0-only
import { loc_51, loc_106, loc_200, loc_201, loc_202 } from "./names.js";

// Init helper: seed five state cells with fixed constants. Takes no inputs.
export function loc_921b(m) {
  const { mem8 } = m;
  mem8[loc_200] = 0x0e;
  mem8[loc_51] = 0xf0;
  mem8[loc_106] = 0x00;
  mem8[loc_201] = 0x0f;
  mem8[loc_202] = 0x10;
  return;
}
