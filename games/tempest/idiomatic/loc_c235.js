// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_c2e8 } from "./loc_c2e8.js";
import {
  loc_2, loc_3d, loc_46, loc_5b, loc_5d, loc_5f, loc_60, loc_66, loc_67,
  loc_68, loc_69, loc_a0, loc_10f, loc_110, loc_111, loc_112, loc_113, loc_121,
  loc_31a, loc_33a, loc_39a, loc_3ce, loc_3de, loc_3ee, loc_435, loc_445,
  loc_b97c, loc_ba7c, loc_bb7c, loc_bc8c, loc_bc9c, loc_bcac, loc_bcbc, loc_bccc,
} from "./names.js";

// Level-geometry setup: reduce the selected slot, derive the span cells from the
// level tables, fold the offset pair (copy or 4-step shift-right difference), then
// seed the six per-column arrays and average adjacent neighbours into two more.
export function loc_c235(m) {
  const { mem8 } = m;
  const seed = loc_c2e8(m, mem8[u8(loc_46 + mem8[loc_3d])])[0];
  const y = mem8[loc_112];

  const neg = u8(-mem8[u16(loc_bc8c + y)]);
  mem8[loc_5f] = neg;
  mem8[loc_5d] = neg;
  mem8[loc_a0] = u8(0x10 - neg);
  mem8[loc_5b] = 0xff;
  mem8[loc_60] = mem8[u16(loc_bc9c + y)];
  mem8[loc_111] = mem8[u16(loc_bccc + y)];

  if (mem8[loc_2] === 0x1e) {
    mem8[loc_68] = mem8[u16(loc_bcac + y)];
    mem8[loc_69] = mem8[u16(loc_bcbc + y)];
  } else {
    // signed 16-bit difference {bcbc:bcac} - {$69:$68}, then >> 4 keeping the low byte
    const diffLo = mem8[u16(loc_bcac + y)] - mem8[loc_68];
    const carry = diffLo >= 0 ? 1 : 0;
    let low = diffLo & 0xff;
    let high = (mem8[u16(loc_bcbc + y)] - mem8[loc_69] - (1 - carry)) & 0xff;
    for (let i = 0; i < 4; i++) {
      const bit = high & 0x01;
      high >>= 1;
      low = ((bit << 7) | (low >> 1)) & 0xff;
    }
    mem8[loc_121] = low;
  }

  mem8[loc_66] = 0x00;
  mem8[loc_67] = 0x00;
  mem8[loc_10f] = 0x00;
  mem8[loc_110] = 0x00;
  mem8[loc_113] = 0x2c;

  // Seed six per-column arrays top-down; the neighbour index walks down from `seed`.
  let ny = seed;
  for (let x = 0x0f; x >= 0; x--) {
    mem8[u16(loc_3ce + x)] = mem8[u16(loc_b97c + ny)];
    mem8[u16(loc_3de + x)] = mem8[u16(loc_ba7c + ny)];
    mem8[u16(loc_31a + x)] = 0x00;
    mem8[u16(loc_33a + x)] = 0x00;
    mem8[u16(loc_39a + x)] = 0x00;
    mem8[u16(loc_3ee + x)] = mem8[u16(loc_bb7c + ny)];
    ny = u8(ny - 1);
  }

  // Rounding-average each column with its next neighbour (wrapping) into two arrays.
  for (let x = 0x0f; x >= 0; x--) {
    const nx = (x + 1) & 0x0f;
    mem8[u16(loc_435 + x)] = avg(mem8[u16(loc_3ce + nx)], mem8[u16(loc_3ce + x)]);
    mem8[u16(loc_445 + x)] = avg(mem8[u16(loc_3de + nx)], mem8[u16(loc_3de + x)]);
  }
}

// Add two bytes plus one, then rotate right carrying the ninth bit into bit 7.
function avg(a, b) {
  const sum = a + b + 1;
  const cout = sum > 0xff ? 0x80 : 0x00;
  return (cout | ((sum & 0xff) >> 1)) & 0xff;
}
