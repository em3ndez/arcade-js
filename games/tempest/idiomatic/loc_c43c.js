// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_37, loc_35a, loc_36a, loc_37a, loc_38a, loc_61, loc_62, loc_63, loc_64 } from "./names.js";

// Read the current slot index and copy that column of four parallel tables into the working block.
export function loc_c43c(m) {
  const { mem8 } = m;
  const x = mem8[loc_37];
  mem8[loc_61] = mem8[u16(loc_36a + x)];
  mem8[loc_62] = mem8[u16(loc_35a + x)];
  mem8[loc_63] = mem8[u16(loc_38a + x)];
  mem8[loc_64] = mem8[u16(loc_37a + x)];
  return;
}
