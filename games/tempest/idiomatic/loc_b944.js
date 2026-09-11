// SPDX-License-Identifier: GPL-3.0-only
import { loc_74, loc_75, loc_76, loc_77 } from "./names.js";

// Swap the two 16-bit pointers so the shared cursors address the other structure.
export function loc_b944(m) {
  const { mem8 } = m;
  const lo = mem8[loc_74]; // save the first pointer's low byte
  const hi = mem8[loc_75]; // save the first pointer's high byte
  mem8[loc_74] = mem8[loc_76];
  mem8[loc_75] = mem8[loc_77];
  mem8[loc_76] = lo;
  mem8[loc_77] = hi;
}
