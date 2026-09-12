// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  loc_3, loc_29, loc_2a, loc_2b, loc_2c, loc_3b, loc_58, loc_b0,
  loc_106, loc_111, loc_114, loc_11c, loc_124, loc_125, loc_148, loc_157,
  loc_200, loc_201, loc_202, loc_283, loc_2b9, loc_2cc, loc_2df, loc_425,
  loc_b476, loc_b487,
} from "./names.js";
import { loc_b2be } from "./loc_b2be.js";
import { loc_c30d } from "./loc_c30d.js";
import { loc_b2fe } from "./loc_b2fe.js";
import { loc_b2de } from "./loc_b2de.js";

// Rebuild the 16-entry display-flag block from the active enemy tables, then walk
// two 16-entry passes writing per-column state through one indirect list and OR-ing
// color bits into another.
export function loc_b367(m) {
  const { mem8, mem16 } = m;

  // Optional pre-pass of pointer/slot setup, then always refresh the base pointer.
  if (mem8[loc_114] !== 0) {
    loc_b2be(m, 0x02);
    loc_c30d(m);
    loc_b2fe(m, 0x02);
  }
  loc_b2de(m, 0x02);

  // Clear the flag block.
  for (let x = 0x0f; x >= 0; x--) mem8[u16(loc_425 + x)] = 0x00;

  // Merge enemy state into the flag block (unless the guard byte is negative).
  if ((mem8[loc_106] & 0x80) === 0) {
    let x = mem8[loc_11c];
    do {
      if (mem8[u16(loc_2df + x)] !== 0 && (mem8[u16(loc_283 + x)] & 0x07) === 0x01) {
        mem8[loc_29] = 0x01;
        if ((mem8[u16(loc_283 + x)] & 0x80) === 0) {
          if ((mem8[loc_148] & 0x80) === 0 && mem8[u16(loc_2df + x)] < mem8[loc_157]) {
            mem8[loc_29] = mem8[loc_29] + 2;
          }
          const near = mem8[u16(loc_2cc + x)];
          mem8[u16(loc_425 + near)] |= mem8[loc_29];
        }
        const far = mem8[u16(loc_2b9 + x)];
        mem8[u16(loc_425 + far)] |= mem8[loc_29] | 0x80;
      }
      x = (x - 1) & 0xff;
    } while ((x & 0x80) === 0);
  }

  // Base color value for the first pass.
  let base = 0x06;
  const gate = mem8[loc_125];
  if (gate !== 0 && (gate & 0x80) === 0 && (mem8[loc_3] & 0x07) === 0x07) base = 0x01;
  mem8[loc_29] = base;

  // Cache the two "special" column indices from the coordinate cells.
  mem8[loc_2c] = 0xff;
  let colA = 0xff, colB = 0xff;
  if (mem8[loc_202] !== 0 && (mem8[loc_201] & 0x80) === 0) {
    colA = mem8[loc_200];
    colB = mem8[loc_201];
  }
  mem8[loc_2a] = colA;
  mem8[loc_2b] = colB;
  const anim = mem8[loc_124];
  if ((anim & 0x80) === 0) {
    mem8[loc_2c] = (anim & 0x0e) >> 1;
    mem8[loc_124] = anim - 1;
  }

  // First pass: pick each column's value and store it through the ($3b) list.
  for (let x = 0x0f; x >= 0; x--) {
    let value;
    const flag = mem8[u16(loc_425 + x)];
    if (flag !== 0) {
      value = (flag & 0x02) !== 0 ? (mem8[loc_3] & 0x01) : 0x06;
    } else if (x === mem8[loc_2a] || x === mem8[loc_2b]) {
      value = 0x01;
    } else if (mem8[loc_124] & 0x80) {
      value = mem8[loc_29];
    } else {
      let seg = (x + mem8[loc_2c]) & 0x07;
      value = seg === 0x07 ? 0x03 : seg;
    }
    const slot = mem8[u16(loc_b476 + x)];
    mem8[u16(mem16[loc_3b] + slot)] = value;
  }

  // Second pass: OR the flag's color bits into the ($b0) list.
  let x = mem8[loc_111] & 0x80 ? 0x0e : 0x0f;
  do {
    const color = mem8[u16(loc_425 + x)] & 0x80 ? 0x00 : 0xc0;
    mem8[loc_58] = color;
    const slot = mem8[u16(loc_b487 + x)];
    const dst = u16(mem16[loc_b0] + slot);
    mem8[dst] = (mem8[dst] & 0x1f) | mem8[loc_58];
    x = (x - 1) & 0xff;
  } while ((x & 0x80) === 0);
}
