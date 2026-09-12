// SPDX-License-Identifier: GPL-3.0-only
import { loc_0, loc_7c, loc_1c7, loc_1c9, loc_1ca } from "./names.js";
import { loc_de11 } from "./loc_de11.js";

// When both guard bytes are clear, run the walk seeder and stamp two scratch cells.
export function loc_db5a(m) {
  const { mem8 } = m;
  if ((mem8[loc_1ca] | mem8[loc_1c7]) !== 0) return;
  loc_de11(m);
  mem8[loc_7c] = mem8[loc_1c9];
  mem8[loc_0] = 0x02;
}
