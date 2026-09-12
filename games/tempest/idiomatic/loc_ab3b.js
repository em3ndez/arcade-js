// SPDX-License-Identifier: GPL-3.0-only
import { u16, u8 } from "../../../core/int.js";
import { loc_2a, loc_2b, loc_2c, loc_35, loc_3b, loc_3c, loc_72, loc_73, loc_74, loc_ac, loc_d121, loc_31e4, loc_31e5 } from "./names.js";
import { loc_df6a } from "./loc_df6a.js";
import { loc_df75 } from "./loc_df75.js";
import { loc_b0d1 } from "./loc_b0d1.js";
import { loc_b0dd } from "./loc_b0dd.js";
import { loc_df5f } from "./loc_df5f.js";

// Draw a scaled vector list: seed the header, set scale from a split table nibble,
// copy indexed point pairs into the output buffer until a high-bit terminator, then close.
export function loc_ab3b(m) {
  const { mem8, mem16 } = m;
  mem8[loc_73] = 0x00;
  mem8[loc_72] = 0x01;
  loc_df6a(m, 0x01); // A live-in = the 0x01 just loaded (STA $72); df6a folds it as a|0x70
  loc_df75(m, mem8[loc_2a], mem8[loc_2b]);
  let y = mem8[loc_35];
  mem8[loc_3b] = mem8[u16(mem16[loc_ac] + y)];
  y = u8(y + 1);
  mem8[loc_3c] = mem8[u16(mem16[loc_ac] + y)];
  const key = mem8[u16(loc_d121 + mem8[loc_35])];
  loc_b0d1(m, key >> 4);
  loc_b0dd(m, key & 0x0f);
  mem8[loc_2a] = 0x00;
  let listIdx = 0x01;
  let entry;
  do {
    entry = mem8[u16(mem16[loc_3b] + listIdx)];
    mem8[loc_2b] = entry;
    const src = entry & 0x7f;
    listIdx = u8(listIdx + 1);
    mem8[loc_2c] = listIdx;
    let outOff = mem8[loc_2a];
    mem8[u16(mem16[loc_74] + outOff)] = mem8[u16(loc_31e4 + src)];
    outOff = u8(outOff + 1);
    mem8[u16(mem16[loc_74] + outOff)] = mem8[u16(loc_31e5 + src)];
    outOff = u8(outOff + 1);
    mem8[loc_2a] = outOff;
  } while ((entry & 0x80) === 0);
  loc_df5f(m, u8(mem8[loc_2a] - 1));
}
