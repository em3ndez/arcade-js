// SPDX-License-Identifier: GPL-3.0-only
import { EAROM_REGION_PENDING, EAROM_REGION_DIR } from "./names.js";
import { loc_de1b } from "./loc_de1b.js";

// Seed the state-machine mode byte to 7, clear its target, then run the walk.
export function loc_de11(m) {
  const { mem8 } = m;
  mem8[EAROM_REGION_PENDING] = 0x07;
  mem8[EAROM_REGION_DIR] = 0x00;
  loc_de1b(m);
}
