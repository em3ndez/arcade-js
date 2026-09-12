// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_63, loc_61, loc_2c, loc_37, loc_73, loc_56, loc_57, loc_58, loc_706, loc_707, loc_708 } from "./names.js";
import { loc_ab14 } from "./loc_ab14.js";
import { loc_b0dd } from "./loc_b0dd.js";
import { loc_ab0d } from "./loc_ab0d.js";
import { loc_df75 } from "./loc_df75.js";
import { loc_b0d1 } from "./loc_b0d1.js";
import { loc_dfb1 } from "./loc_dfb1.js";
import { loc_b56a } from "./loc_b56a.js";
import { loc_aef8 } from "./loc_aef8.js";

// Emit a descending run of slot records, seeding each pass's glyph triple from the table.
export function loc_ae4e(m, a = m.regs.a) {
  const { mem8 } = m;
  mem8[loc_63] = a;
  loc_ab14(m, 0x10);
  mem8[loc_61] = 0x01;
  loc_b0dd(m, 0x01);
  mem8[loc_2c] = 0x28;
  mem8[loc_37] = 0x15;
  do {
    loc_ab0d(m);
    mem8[loc_73] = 0x00;
    const prev = mem8[loc_2c];
    mem8[loc_2c] = prev - 0x0a;
    loc_df75(m, 0xd0, prev);
    loc_b0d1(m, mem8[loc_63] === mem8[loc_37] ? 0x00 : 0x07);
    loc_dfb1(m, 0x61, 0x01);
    loc_b56a(m, 0xa0);
    mem8[loc_73] = 0x00;
    loc_df75(m, 0x08, 0x00);
    mem8[loc_61] = mem8[loc_61] + 1;
    loc_aef8(m, mem8[loc_37]);
    loc_df75(m, 0x08, 0x00);
    const t = mem8[loc_37];
    mem8[loc_56] = mem8[u16(loc_706 + t)];
    mem8[loc_57] = mem8[u16(loc_707 + t)];
    mem8[loc_58] = mem8[u16(loc_708 + t)];
    loc_dfb1(m, 0x56, 0x03);
    mem8[loc_37] = mem8[loc_37] - 3;
  } while (mem8[loc_37] < 0x80);
}
