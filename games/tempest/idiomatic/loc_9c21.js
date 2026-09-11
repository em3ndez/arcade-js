// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_2b9, loc_2df, loc_3ac, loc_10c } from "./names.js";

// For the given slot, look up its boundary value (a zero table entry means the
// maximum) and set a flag to 1 when the boundary is at or beyond the slot's
// coordinate, else 0.
export function loc_9c21(m, x = m.regs.x) {
  const { mem8 } = m;
  const segment = mem8[u16(loc_2b9 + x)];
  let bound = mem8[u16(loc_3ac + segment)];
  if (bound === 0) bound = 0xff; // a zero entry reads as the maximum bound
  mem8[loc_10c] = bound >= mem8[u16(loc_2df + x)] ? 1 : 0;
}
