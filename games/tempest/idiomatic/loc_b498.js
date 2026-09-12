// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  loc_37, loc_46, loc_53, loc_56, loc_61, loc_62, loc_63, loc_64,
  loc_68, loc_69, loc_74, loc_75, loc_9e, loc_b5,
  loc_203, loc_243, loc_35a, loc_36a, loc_37a, loc_38a,
} from "./names.js";
import { loc_df4c } from "./loc_df4c.js";
import { loc_df5f } from "./loc_df5f.js";
import { loc_df6a } from "./loc_df6a.js";
import { loc_c765 } from "./loc_c765.js";

// Build a vector display list for up to 0x12 active objects, emitting a header word,
// screen-relative coordinate words, and their negated shadow words for each object,
// flushing the cursor when the byte offset saturates, then close with a trailing header.
export function loc_b498(m) {
  const { mem8 } = m;
  mem8[loc_9e] = 0x0c;
  loc_df4c(m, 0x08, 0x0c);
  loc_c765(m, 0x66);
  mem8[loc_56] = 0x12;
  mem8[loc_37] = 0x3f;
  let y = 0x00;

  while (true) {
    const idx = mem8[loc_37];
    const kind = mem8[u16(loc_243 + idx)];
    if (kind !== 0) {
      const base = mem8[loc_74] | (mem8[loc_75] << 8);
      let carry = kind >= 0x50 ? 1 : 0;
      if (kind >= 0x50) mem8[loc_37] = mem8[loc_37] - 1;
      mem8[u16(base + y)] = kind & 0x3f;
      // Rotate the raw kind three times to lift its top bits into a small header code.
      let rot = kind;
      for (let i = 0; i < 3; i++) {
        const nextC = (rot >> 7) & 1;
        rot = ((rot << 1) | carry) & 0xff;
        carry = nextC;
      }
      const header = ((rot & 0x03) + 1) | 0x70;
      y = (y + 1) & 0xff;
      mem8[u16(base + y)] = header;
      y = (y + 1) & 0xff;

      const obj = mem8[u16(loc_203 + idx)];
      const dxLo = mem8[u16(loc_38a + obj)] - mem8[loc_68];
      mem8[loc_63] = dxLo;
      mem8[u16(base + y)] = dxLo;
      y = (y + 1) & 0xff;
      const dxHi = mem8[u16(loc_37a + obj)] - mem8[loc_69] - (dxLo < 0 ? 1 : 0);
      mem8[loc_64] = dxHi;
      mem8[u16(base + y)] = dxHi & 0x1f;
      y = (y + 1) & 0xff;

      const dyLo = mem8[u16(loc_36a + obj)];
      mem8[loc_61] = dyLo;
      mem8[u16(base + y)] = dyLo;
      y = (y + 1) & 0xff;
      const dyHi = mem8[u16(loc_35a + obj)];
      mem8[loc_62] = dyHi;
      mem8[u16(base + y)] = dyHi & 0x1f;
      y = (y + 1) & 0xff;

      mem8[u16(base + y)] = 0x00; y = (y + 1) & 0xff;
      mem8[u16(base + y)] = 0x00; y = (y + 1) & 0xff;
      mem8[u16(base + y)] = 0x00; y = (y + 1) & 0xff;
      mem8[u16(base + y)] = 0xa0; y = (y + 1) & 0xff;

      // Emit the negated shadow of each coordinate word.
      const nx = (mem8[loc_63] ^ 0xff) + 1;
      mem8[u16(base + y)] = nx; y = (y + 1) & 0xff;
      const nxHi = (mem8[loc_64] ^ 0xff) + (nx > 0xff ? 1 : 0);
      mem8[u16(base + y)] = nxHi & 0x1f; y = (y + 1) & 0xff;
      const ny = (mem8[loc_61] ^ 0xff) + 1;
      mem8[u16(base + y)] = ny; y = (y + 1) & 0xff;
      const nyHi = (mem8[loc_62] ^ 0xff) + (ny > 0xff ? 1 : 0);
      mem8[u16(base + y)] = nyHi & 0x1f; y = (y + 1) & 0xff;

      if (y >= 0xf0) {
        y = (y - 1) & 0xff;
        loc_df5f(m, y);
        y = 0x00;
      }
      const left = (mem8[loc_56] - 1) & 0xff;
      mem8[loc_56] = left;
      if (left & 0x80) break;
    }
    const rem = (mem8[loc_37] - 1) & 0xff;
    mem8[loc_37] = rem;
    if (rem & 0x80) break;
  }

  if (y !== 0) {
    y = (y - 1) & 0xff;
    loc_df5f(m, y);
  }
  if (mem8[loc_b5] !== 0 && mem8[loc_46] >= 0x0a) mem8[loc_53] = 0x7a;
  return loc_df6a(m, 0x01);
}
