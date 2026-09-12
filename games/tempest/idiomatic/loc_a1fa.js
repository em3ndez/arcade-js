// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, loc_2a, loc_2b, loc_37, loc_135, loc_2ad, loc_2d3, loc_2f2, loc_39a, loc_3ac } from "./names.js";
import { loc_ccf6 } from "./loc_ccf6.js";
import { loc_ca6c } from "./loc_ca6c.js";

// Advance a slot's counter toward its per-target limit; on reaching a nonzero limit, clamp/clear
// the limit cell, bump the hit tally, flag the target, chime, and award. After two hits, reset the
// counter and drop a life. Returns the slot index live at exit.
export function loc_a1fa(m, x = m.regs.x) {
  const { mem8 } = m;
  const y = mem8[u16(loc_2ad + x)];
  const limit = mem8[u16(loc_3ac + y)];
  if (limit === 0) return x;

  let xEff = x;
  const counter = mem8[u16(loc_2d3 + x)];
  if (counter >= limit) {
    mem8[u16(loc_3ac + y)] = counter < 0xf0 ? counter : 0x00; // clamp: clear unless already saturated
    mem8[u16(loc_2f2 + x)] = mem8[u16(loc_2f2 + x)] + 1;      // bump hit tally
    mem8[u16(loc_39a + y)] = 0xc0;                            // flag the target
    loc_ccf6(m, x, y);                                        // chime
    mem8[loc_2a] = 0x00;
    mem8[loc_2b] = 0x00;
    mem8[loc_29] = 0x01;
    loc_ca6c(m, 0xff);                                        // award
    xEff = mem8[loc_37];
  }

  if (mem8[u16(loc_2f2 + xEff)] >= 0x02) {                    // second hit: reset + drop a life
    mem8[u16(loc_2d3 + xEff)] = 0x00;
    mem8[loc_135] = mem8[loc_135] - 1;
  }
  return xEff;
}
