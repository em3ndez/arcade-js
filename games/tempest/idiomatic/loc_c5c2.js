// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  loc_37, loc_38, loc_5b, loc_5f, loc_6a, loc_6b, loc_6c, loc_6d,
  loc_74, loc_75, loc_a9, loc_aa, loc_ab, loc_110, loc_111, loc_114,
  loc_39a, loc_c669,
} from "./names.js";
import { loc_c66d } from "./loc_c66d.js";
import { loc_c6c7 } from "./loc_c6c7.js";
import { loc_df5f } from "./loc_df5f.js";
import { loc_df6a } from "./loc_df6a.js";

// Rebuild the per-frame enemy display list: for each active slot copy a fixed header, then
// append either a computed midpoint pair or a straight/sign-fixed coordinate block.
export function loc_c5c2(m) {
  const { mem8, mem16 } = m;

  if (mem8[loc_110] !== 0) return;
  if (mem8[loc_5b] === 0 && mem8[loc_5f] >= 0xf0) return;

  loc_df6a(m, 0x01);

  const savedLo = mem8[loc_74];
  const savedHi = mem8[loc_75];
  mem8[loc_38] = 0x00;
  mem8[loc_a9] = 0x00;

  let slot = 0x0f;
  if (mem8[loc_111] !== 0) slot = (slot - 1) & 0xff;
  mem8[loc_37] = slot;

  for (;;) {
    const dest = mem16[loc_74];
    let cursor = mem8[loc_a9];
    for (let h = 3; h >= 0; h--) {
      mem8[u16(dest + cursor)] = mem8[u16(loc_c669 + h)];
      cursor = u8(cursor + 1);
    }
    mem8[loc_a9] = cursor;

    if (mem8[loc_114] !== 0) {
      loc_c66d(m);
      loc_c6c7(m);
    } else {
      const kind = mem8[u16(loc_39a + mem8[loc_38])];
      const src = mem16[loc_aa];
      let y = mem8[loc_a9];
      if (kind & 0x80) {
        const b0 = mem8[u16(src + y)]; mem8[u16(dest + y)] = b0; mem8[loc_6c] = b0; y = u8(y + 1);
        const b1 = mem8[u16(src + y)]; mem8[u16(dest + y)] = b1; mem8[loc_6d] = b1 >= 0x10 ? b1 | 0xe0 : b1; y = u8(y + 1);
        const b2 = mem8[u16(src + y)]; mem8[u16(dest + y)] = b2; mem8[loc_6a] = b2; y = u8(y + 1);
        const b3 = mem8[u16(src + y)]; mem8[u16(dest + y)] = b3; mem8[loc_6b] = b3 >= 0x10 ? b3 | 0xe0 : b3; y = u8(y + 1);
        mem8[loc_a9] = y;
        loc_c6c7(m);
      } else {
        for (let c = 0x0b; c >= 0; c--) {
          mem8[u16(dest + y)] = mem8[u16(src + y)];
          y = u8(y + 1);
        }
        mem8[loc_a9] = y;
      }
    }

    const idx = mem8[loc_38];
    mem8[u16(loc_39a + idx)] = mem8[u16(loc_39a + idx)] << 1;
    mem8[loc_38] = u8(mem8[loc_38] + 1);
    const next = u8(mem8[loc_37] - 1);
    mem8[loc_37] = next;
    if (next >= 0x80) break;
  }

  mem8[loc_ab] = savedHi;
  mem8[loc_aa] = savedLo;
  loc_df5f(m, u8(mem8[loc_a9] - 1));
}
