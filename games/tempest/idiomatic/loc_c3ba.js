// SPDX-License-Identifier: GPL-3.0-only
import { loc_61, loc_62, loc_63, loc_64, loc_6a, loc_6b, loc_6c, loc_6d, loc_6e, loc_6f, loc_70, loc_71, loc_73 } from "./names.js";
import { loc_df92 } from "./loc_df92.js";

// Store two 16-bit differences (current minus previous) into the delta slots, emit
// the record through the cursor, then latch current into previous and flag it ready.
export function loc_c3ba(m) {
  const { mem8 } = m;
  const d0 = mem8[loc_61] - mem8[loc_6a];
  mem8[loc_6e] = d0;
  mem8[loc_6f] = mem8[loc_62] - mem8[loc_6b] - (d0 < 0 ? 1 : 0);
  const d1 = mem8[loc_63] - mem8[loc_6c];
  mem8[loc_70] = d1;
  mem8[loc_71] = mem8[loc_64] - mem8[loc_6d] - (d1 < 0 ? 1 : 0);
  loc_df92(m, loc_6e);
  mem8[loc_6a] = mem8[loc_61];
  mem8[loc_6b] = mem8[loc_62];
  mem8[loc_6c] = mem8[loc_63];
  mem8[loc_6d] = mem8[loc_64];
  mem8[loc_73] = 0xc0;
}
