// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_38, loc_39, loc_74, loc_606, loc_31fa } from "./names.js";
import { loc_df5f } from "./loc_df5f.js";

// Copy three 2-byte glyph words into the pointer buffer: each source byte (capped at 0x1a) indexes a
// word table; after the copies, advance the buffer cursor past what was written.
export function loc_aef8(m, a = m.regs.a) {
  const { mem8, mem16 } = m;
  mem8[loc_38] = u8(a + 2);
  mem8[loc_39] = 0x02;
  const p = mem16[loc_74];
  let y = 0x00;
  while (true) {
    const cell = mem8[u16(loc_606 + mem8[loc_38])];
    const idx = u8((cell >= 0x1e ? 0x1a : cell) << 1);
    mem8[u16(p + y)] = mem8[u16(loc_31fa + idx)];
    y = u8(y + 1);
    mem8[u16(p + y)] = mem8[u16(loc_31fa + idx + 1)];
    y = u8(y + 1);
    mem8[loc_38] = u8(mem8[loc_38] - 1);
    mem8[loc_39] = u8(mem8[loc_39] - 1);
    if (mem8[loc_39] < 0x80) continue; // loop while non-negative
    break;
  }
  y = u8(y - 1);
  return loc_df5f(m, y);
}
