// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_a028 } from "./loc_a028.js";
import { loc_10c, loc_2b9, loc_3ac, loc_2df, loc_39a, loc_28a, loc_283, loc_3ab } from "./names.js";

// Advance slot x toward its column target: seed an empty column to 0xf1, keep the column
// depth as the running minimum (tagging a fresh min), then clamp shallow depths or, past
// the far limit, pick a new column and rewrite the slot's flag/segment fields.
export function loc_9fc4(m, x = m.regs.x) {
  const { mem8 } = m;
  mem8[loc_10c] = 1;
  const col = mem8[u16(loc_2b9 + x)];
  const colAddr = u16(loc_3ac + col);
  if (mem8[colAddr] === 0) mem8[colAddr] = 0xf1;

  const depthAddr = u16(loc_2df + x);
  if (mem8[depthAddr] < mem8[colAddr]) {          // fresh minimum for this column
    mem8[colAddr] = mem8[depthAddr];
    mem8[u16(loc_39a + col)] = 0x80;
  }

  const depth = mem8[depthAddr];
  if (depth < 0x20) {                             // too shallow -> flag and clamp
    mem8[u16(loc_28a + x)] |= 0x80;
    mem8[depthAddr] = 0x20;
    return;
  }
  if (depth < 0xf2) return;                       // mid-range -> nothing more

  loc_a028(m, x);                                 // past the far limit -> pick a new column
  mem8[depthAddr] = 0xf0;
  if (mem8[loc_3ab] !== 0) return;

  mem8[u16(loc_28a + x)] = (mem8[u16(loc_28a + x)] & 0xfc) | 0x01;
  mem8[u16(loc_283 + x)] = (mem8[u16(loc_283 + x)] & 0xf8) | 0x02;
  mem8[loc_10c] = 0;
}
