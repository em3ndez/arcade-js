// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_37, loc_31a, loc_32a, loc_33a, loc_34a, loc_61, loc_62, loc_63, loc_64 } from "./names.js";
import { loc_c3ba } from "./loc_c3ba.js";

// Snapshot four indexed table cells into the record header, then emit the record.
export function loc_c423(m) {
  const { mem8 } = m;
  const x = mem8[loc_37];
  mem8[loc_61] = mem8[u16(loc_32a + x)];
  mem8[loc_62] = mem8[u16(loc_31a + x)];
  mem8[loc_63] = mem8[u16(loc_34a + x)];
  mem8[loc_64] = mem8[u16(loc_33a + x)];
  return loc_c3ba(m);
}
