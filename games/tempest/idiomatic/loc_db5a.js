// SPDX-License-Identifier: GPL-3.0-only
import { GAME_MODE, SEG_SPREAD_A_LO_4, EAROM_REGION_PENDING, PENDING_WORK_FLAGS, EAROM_MODE } from "./names.js";
import { loc_de11 } from "./loc_de11.js";

// When both guard bytes are clear, run the walk seeder and stamp two scratch cells.
export function loc_db5a(m) {
  const { mem8 } = m;
  if ((mem8[EAROM_MODE] | mem8[EAROM_REGION_PENDING]) !== 0) return;
  loc_de11(m);
  mem8[SEG_SPREAD_A_LO_4] = mem8[PENDING_WORK_FLAGS];
  mem8[GAME_MODE] = 0x02;
}
