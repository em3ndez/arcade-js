// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_0, loc_2, loc_4, loc_5c, loc_9f, loc_104, loc_105, loc_106, loc_107, loc_123, loc_125, loc_3ac } from "./names.js";

// Reset a batch of state bytes, then count how many of the 16 entries are live.
// If any are live and the level is below seven, load the intro parameter block.
// Always mark the block ready at the end.
export function loc_a5cb(m) {
  const { mem8 } = m;
  mem8[loc_0] = 0x20;
  mem8[loc_106] = mem8[loc_106] | 0x80;
  mem8[loc_104] = 0;
  mem8[loc_107] = 0;
  mem8[loc_5c] = 0;
  mem8[loc_123] = 0;
  mem8[loc_105] = 0x02;
  for (let x = 0x0f; x >= 0; x--) {
    if (mem8[u16(loc_3ac + x)] !== 0) mem8[loc_123] = u8(mem8[loc_123] + 1);
  }
  if (mem8[loc_123] !== 0 && mem8[loc_9f] < 0x07) {
    mem8[loc_4] = 0x1e;
    mem8[loc_0] = 0x0a;
    mem8[loc_2] = 0x20;
    mem8[loc_123] = 0x80;
  }
  mem8[loc_125] = 0xff;
}
