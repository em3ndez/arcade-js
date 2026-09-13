// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { SCORE_DISPLAY_TIMER, ACTIVE_SLOT, REARM_COUNTER } from "./names.js";
import { loc_a8b4 } from "./loc_a8b4.js";
import { loc_ab17 } from "./loc_ab17.js";
import { loc_aa97 } from "./loc_aa97.js";
import { loc_ab14 } from "./loc_ab14.js";
import { loc_ae4e } from "./loc_ae4e.js";

// Draw the fixed frame, tick a countdown, then hand a score delta to the row builder.
export function loc_adea(m) {
  const { mem8 } = m;
  loc_a8b4(m);
  loc_ab17(m, 0xc0, 0x02);
  mem8[SCORE_DISPLAY_TIMER] = u8(mem8[SCORE_DISPLAY_TIMER] - 1);
  loc_aa97(m);
  loc_ab14(m, 0x0a);
  loc_ab17(m, 0xa6, 0x0c);
  loc_ab17(m, 0x9c, 0x0e);
  loc_ab14(m, 0x2c);
  const delta = u8(mem8[ACTIVE_SLOT] - mem8[REARM_COUNTER]);
  return loc_ae4e(m, delta);
}
