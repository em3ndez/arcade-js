// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  loc_2b, loc_2d, loc_2e, loc_2f, loc_30, loc_36, loc_38,
  loc_56, loc_57, loc_58, loc_59, loc_5a, loc_5b, loc_5f,
  loc_61, loc_62, loc_63, loc_64, loc_6a, loc_6b, loc_6c, loc_6d,
  loc_73, loc_74, loc_78, loc_79, loc_7a, loc_7b, loc_7c, loc_7d, loc_7e, loc_7f,
  loc_80, loc_82, loc_83, loc_84, loc_85, loc_86, loc_87,
  loc_88, loc_89, loc_8a, loc_8b, loc_8c, loc_8d, loc_8e, loc_8f,
  loc_90, loc_92, loc_93, loc_94, loc_95, loc_96, loc_97, loc_99, loc_9b, loc_9d, loc_9e, loc_a9,
  loc_3ce, loc_3de, loc_bfb6, loc_bfc4, loc_bfd2, loc_bfd3,
} from "./names.js";
import { loc_c098 } from "./loc_c098.js";
import { loc_c765 } from "./loc_c765.js";
import { loc_df4c } from "./loc_df4c.js";
import { loc_df5f } from "./loc_df5f.js";
import { loc_df6c } from "./loc_df6c.js";

// Full entry: capture the source/next-corner endpoints for a segment, seed the run counters,
// then hand off to the shared builder.
export function loc_bda0(m, a = m.regs.a, y = m.regs.y) {
  const { mem8 } = m;
  mem8[loc_36] = a;
  mem8[loc_56] = mem8[u16(loc_3ce + y)];
  mem8[loc_58] = mem8[u16(loc_3de + y)];
  mem8[loc_2f] = mem8[loc_57];
  const nc = (y + 1) & 0x0f;
  mem8[loc_2e] = mem8[u16(loc_3ce + nc)];
  mem8[loc_30] = mem8[u16(loc_3de + nc)];
  mem8[loc_59] = 0x00;
  mem8[loc_5a] = 0x04;
  return loc_bdcb(m, mem8[loc_36]);
}

// Shared builder (also entered directly): early-out unless active, transform both endpoints,
// form two clamped signed deltas, expand a fivefold spread table, then emit N four-byte
// records into the ($74) cursor and advance it.
export function loc_bdcb(m, corner = m.regs.y) {
  const { mem8, mem16 } = m;
  if (!(mem8[loc_5b] & 0x80)) {
    if (mem8[loc_57] < mem8[loc_5f]) return;
  }
  mem8[loc_99] = mem8[u16(loc_bfb6 + corner)];
  mem8[loc_38] = mem8[u16(loc_bfc4 + corner)];
  loc_df4c(m, 0x08, mem8[loc_9e]);
  loc_c098(m);
  loc_c765(m, 0x61);
  mem8[loc_56] = mem8[loc_2e];
  mem8[loc_57] = mem8[loc_2f];
  mem8[loc_58] = mem8[loc_30];
  loc_c098(m);
  loc_df6c(m, mem8[loc_5a], mem8[loc_59]);

  // delta 1 -> clamped magnitude in $79, sign high byte in $9b
  {
    const d = mem8[loc_61] - mem8[loc_6a];
    mem8[loc_79] = d;
    mem8[loc_9b] = mem8[loc_62] - mem8[loc_6b] - (d < 0 ? 1 : 0);
    if (mem8[loc_9b] & 0x80) {
      if (mem8[loc_9b] === 0xff) mem8[loc_79] = mem8[loc_79] === 0 ? 0xff : 256 - mem8[loc_79];
      else mem8[loc_79] = 0xff;
    } else if (mem8[loc_9b] !== 0) {
      mem8[loc_79] = 0xff;
    }
  }
  // delta 2 -> clamped magnitude in $89, sign high byte in $9d
  {
    const d = mem8[loc_63] - mem8[loc_6c];
    mem8[loc_89] = d;
    mem8[loc_9d] = mem8[loc_64] - mem8[loc_6d] - (d < 0 ? 1 : 0);
    if (mem8[loc_9d] & 0x80) {
      if (mem8[loc_9d] === 0xff) mem8[loc_89] = 256 - mem8[loc_89];
      else mem8[loc_89] = 0xff;
    } else if (mem8[loc_9d] !== 0) {
      mem8[loc_89] = 0xff;
    }
  }

  // fivefold spread: two 24-bit chains ($82/$83/$84... and $92/$93/$94...) built from $79 and $89
  let a = 0, cf = 0;
  mem8[loc_82] = 0x00;
  mem8[loc_92] = 0x00;
  a = mem8[loc_79]; cf = (a >> 7) & 1; a = (a << 1) & 0xff;
  { const t = ((mem8[loc_82] << 1) | cf) & 0xff; cf = (mem8[loc_82] >> 7) & 1; mem8[loc_82] = t; }
  mem8[loc_7a] = a;
  cf = (a >> 7) & 1; a = (a << 1) & 0xff;
  mem8[loc_7c] = a;
  a = mem8[loc_82]; { const c0 = cf; cf = (a >> 7) & 1; a = ((a << 1) | c0) & 0xff; }
  mem8[loc_84] = a;
  a = mem8[loc_7c]; { const s = a + mem8[loc_79] + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; }
  mem8[loc_7d] = a;
  a = mem8[loc_84]; { const s = a + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; }
  mem8[loc_85] = a;
  a = mem8[loc_7a]; { const s = a + mem8[loc_79] + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; }
  mem8[loc_7b] = a;
  a = mem8[loc_82]; { const s = a + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; }
  mem8[loc_83] = a;
  mem8[loc_86] = a;
  a = mem8[loc_7b]; cf = (a >> 7) & 1; a = (a << 1) & 0xff;
  mem8[loc_7e] = a;
  { const t = ((mem8[loc_86] << 1) | cf) & 0xff; cf = (mem8[loc_86] >> 7) & 1; mem8[loc_86] = t; }
  { const s = a + mem8[loc_79] + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; }
  mem8[loc_7f] = a;
  a = mem8[loc_86]; { const s = a + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; }
  mem8[loc_87] = a;
  a = mem8[loc_89]; cf = (a >> 7) & 1; a = (a << 1) & 0xff;
  { const t = ((mem8[loc_92] << 1) | cf) & 0xff; cf = (mem8[loc_92] >> 7) & 1; mem8[loc_92] = t; }
  mem8[loc_8a] = a;
  cf = (a >> 7) & 1; a = (a << 1) & 0xff;
  mem8[loc_8c] = a;
  a = mem8[loc_92]; { const c0 = cf; cf = (a >> 7) & 1; a = ((a << 1) | c0) & 0xff; }
  mem8[loc_94] = a;
  a = mem8[loc_8c]; { const s = a + mem8[loc_89] + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; }
  mem8[loc_8d] = a;
  a = mem8[loc_94]; { const s = a + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; }
  mem8[loc_95] = a;
  a = mem8[loc_8a]; { const s = a + mem8[loc_89] + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; }
  mem8[loc_8b] = a;
  a = mem8[loc_92]; { const s = a + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; }
  mem8[loc_93] = a;
  mem8[loc_96] = a;
  a = mem8[loc_8b]; cf = (a >> 7) & 1; a = (a << 1) & 0xff;
  mem8[loc_8e] = a;
  { const t = ((mem8[loc_96] << 1) | cf) & 0xff; cf = (mem8[loc_96] >> 7) & 1; mem8[loc_96] = t; }
  { const s = a + mem8[loc_89] + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; }
  mem8[loc_8f] = a;
  a = mem8[loc_96]; { const s = a + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; }
  mem8[loc_97] = a;
  mem8[loc_a9] = 0x00;

  // emit $99 four-byte records: per record pick a header, decode a packed corner byte, then
  // combine the spread offsets by the packed sign bits into a rotated point pair.
  do {
    const yTab = mem8[loc_38];
    let header = mem8[u16(loc_bfd3 + yTab)];
    if (header === 1) header = 0xc0;
    mem8[loc_73] = header;
    const packed = mem8[u16(loc_bfd2 + yTab)];
    mem8[loc_2d] = packed;
    mem8[loc_38] = yTab + 2;
    const dbl = (packed << 1) & 0xff;
    mem8[loc_2b] = dbl;
    const yLo = packed & 0x07;
    const xHi = (dbl >> 4) & 0x07;

    // point A low/high, optionally negated by $9b's sign
    if ((dbl ^ mem8[loc_9b]) & 0x80) {
      const lo = (~mem8[u16(loc_78 + yLo)] & 0xff) + 1;
      mem8[loc_61] = lo;
      mem8[loc_62] = (~mem8[u16(loc_80 + yLo)] & 0xff) + (lo > 0xff ? 1 : 0);
    } else {
      mem8[loc_61] = mem8[u16(loc_78 + yLo)];
      mem8[loc_62] = mem8[u16(loc_80 + yLo)];
    }
    // combine with the x offset by $9d's sign
    if (!((mem8[loc_2d] ^ mem8[loc_9d]) & 0x80)) {
      const d = mem8[loc_61] - mem8[u8(loc_88 + xHi)];
      mem8[loc_61] = d;
      mem8[loc_62] = mem8[loc_62] - mem8[u8(loc_90 + xHi)] - (d < 0 ? 1 : 0);
    } else {
      const s = mem8[u8(loc_88 + xHi)] + mem8[loc_61];
      mem8[loc_61] = s;
      mem8[loc_62] = mem8[u8(loc_90 + xHi)] + mem8[loc_62] + (s > 0xff ? 1 : 0);
    }
    // point B low/high, optionally negated by $9d's sign
    if ((dbl ^ mem8[loc_9d]) & 0x80) {
      const lo = (~mem8[u16(loc_88 + yLo)] & 0xff) + 1;
      mem8[loc_63] = lo;
      mem8[loc_64] = (~mem8[u16(loc_90 + yLo)] & 0xff) + (lo > 0xff ? 1 : 0);
    } else {
      mem8[loc_63] = mem8[u16(loc_88 + yLo)];
      mem8[loc_64] = mem8[u16(loc_90 + yLo)];
    }
    // combine with the y offset by $9b's sign
    if (!((mem8[loc_2d] ^ mem8[loc_9b]) & 0x80)) {
      const s = mem8[loc_63] + mem8[u8(loc_78 + xHi)];
      mem8[loc_63] = s;
      mem8[loc_64] = mem8[loc_64] + mem8[u8(loc_80 + xHi)] + (s > 0xff ? 1 : 0);
    } else {
      const d = mem8[loc_63] - mem8[u8(loc_78 + xHi)];
      mem8[loc_63] = d;
      mem8[loc_64] = mem8[loc_64] - mem8[u8(loc_80 + xHi)] - (d < 0 ? 1 : 0);
    }

    let yy = mem8[loc_a9];
    const base = mem16[loc_74];
    mem8[u16(base + yy)] = mem8[loc_63]; yy = (yy + 1) & 0xff;
    mem8[u16(base + yy)] = mem8[loc_64] & 0x1f; yy = (yy + 1) & 0xff;
    mem8[u16(base + yy)] = mem8[loc_61]; yy = (yy + 1) & 0xff;
    mem8[u16(base + yy)] = (mem8[loc_62] & 0x1f) | mem8[loc_73]; yy = (yy + 1) & 0xff;
    mem8[loc_a9] = yy;
    mem8[loc_99] = mem8[loc_99] - 1;
  } while (mem8[loc_99] !== 0);

  loc_df5f(m, (mem8[loc_a9] - 1) & 0xff);
}
