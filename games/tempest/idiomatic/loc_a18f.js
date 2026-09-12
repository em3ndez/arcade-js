// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_37, loc_a6, loc_118, loc_120, loc_135, loc_202, loc_2d3, loc_2e6, loc_2f2 } from "./names.js";
import { loc_a1fa } from "./loc_a1fa.js";
import { loc_a1e4 } from "./loc_a1e4.js";

// Advance every active slot (index 0x0b..0). Slots 8+ integrate a 16-bit velocity into their
// position pair and clear once past the edge; slots below 8 step a counter (+9, less 4 when flagged)
// then advance it, clearing at the far limit.
export function loc_a18f(m) {
  const { mem8 } = m;

  mem8[loc_37] = 0x0b;
  for (;;) {
    const x = mem8[loc_37];
    if (mem8[u16(loc_2d3 + x)] !== 0) {
      if (x >= 0x08) {
        const lo = mem8[u16(loc_2e6 + x)] + mem8[loc_120];
        mem8[u16(loc_2e6 + x)] = lo;
        const hi = (mem8[u16(loc_2d3 + x)] + mem8[loc_118] + (lo > 0xff ? 1 : 0)) & 0xff;
        if (hi >= mem8[loc_202]) {
          mem8[u16(loc_2d3 + x)] = hi;
        } else {
          mem8[loc_a6] = mem8[loc_a6] - 1;
          loc_a1e4(m, x);
          mem8[u16(loc_2d3 + x)] = 0x00;
        }
      } else {
        let counter = mem8[u16(loc_2d3 + x)] + 0x09;
        if (mem8[u16(loc_2f2 + x)] !== 0) counter -= 0x04;
        mem8[u16(loc_2d3 + x)] = counter;
        const xEff = loc_a1fa(m, x);
        if (mem8[u16(loc_2d3 + xEff)] >= 0xf0) {
          mem8[loc_135] = mem8[loc_135] - 1;
          mem8[u16(loc_2d3 + xEff)] = 0x00;
        }
      }
    }
    const next = (mem8[loc_37] - 1) & 0xff;
    mem8[loc_37] = next;
    if (next & 0x80) break;
  }
}
