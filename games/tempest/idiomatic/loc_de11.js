// SPDX-License-Identifier: GPL-3.0-only
import { loc_1c7, loc_1c8 } from "./names.js";
import { loc_de1b } from "./loc_de1b.js";

// Seed the state-machine mode byte to 7, clear its target, then run the walk.
export function loc_de11(m) {
  const { mem8 } = m;
  mem8[loc_1c7] = 0x07;
  mem8[loc_1c8] = 0x00;
  loc_de1b(m);
}
