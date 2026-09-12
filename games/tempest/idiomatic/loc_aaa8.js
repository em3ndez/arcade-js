// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_3, loc_6, loc_9, loc_a, loc_17, loc_16e, loc_a8b0, loc_aaf3, loc_aaf4 } from "./names.js";
import { loc_ab14 } from "./loc_ab14.js";
import { loc_aeca } from "./loc_aeca.js";
import { loc_af77 } from "./loc_af77.js";
import { loc_df39 } from "./loc_df39.js";

// Per-frame draw driver: pick a slot by phase, tick a timer, draw the shared or the
// alternate panel, redraw two fixed slots, clamp a level index, then post an optional word.
export function loc_aaa8(m) {
  const { mem8 } = m;
  loc_ab14(m, mem8[u16(loc_a8b0 + (mem8[loc_9] & 0x03))]);
  mem8[loc_16e]--;
  // Draw the alternate slot only when the phase gate is set and the mode flag is clear.
  if ((mem8[loc_a] & 0x01) !== 0 && (mem8[loc_3] & 0x20) === 0) {
    loc_ab14(m, 0x32);
  } else {
    loc_aeca(m);
  }
  loc_ab14(m, 0x2c);
  loc_ab14(m, 0x2e);
  if (mem8[loc_6] >= 0x28) mem8[loc_6] = 0x28; // clamp to the ceiling
  loc_af77(m, mem8[loc_6]);
  if (mem8[loc_17] !== 0) loc_df39(m, mem8[loc_aaf4], mem8[loc_aaf3]);
}
