// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  loc_00, loc_5, loc_38, loc_3b, loc_3c, loc_3d, loc_3e,
  loc_43, loc_44, loc_45, loc_102, loc_123, loc_16c, loc_2f60,
  loc_31fa, loc_61b, loc_aace, loc_cde4, loc_cde5,
} from "./names.js";
import { loc_aaa8 } from "./loc_aaa8.js";
import { loc_a97f } from "./loc_a97f.js";
import { loc_a9d7 } from "./loc_a9d7.js";
import { loc_df39 } from "./loc_df39.js";
import { loc_ab14 } from "./loc_ab14.js";
import { loc_b0c6 } from "./loc_b0c6.js";

// Per-frame draw setup: refresh sprites, rebuild a checksum and a small coordinate
// table unless idle, then issue the ordered chain of draw calls.
export function loc_a8e7(m) {
  const { mem8 } = m;
  loc_aaa8(m);
  loc_a97f(m, 0x01, 0x00);
  // Second sprite pass runs only when the gating value is non-zero.
  let skipSecond;
  if (mem8[loc_5] & 0x80) skipSecond = mem8[loc_3e] === 0;
  else skipSecond = (mem8[loc_43] | mem8[loc_44] | mem8[loc_45]) === 0;
  if (!skipSecond) loc_a97f(m, 0x01, 0x01);

  if (mem8[loc_00] !== 0x04) {
    mem8[loc_3b] = 0x1d;
    mem8[loc_3c] = 0x07;
    loc_a9d7(m, mem8[loc_cde4]);
    // Fold a fixed span into one checksum byte.
    let sum = 0xa7;
    for (let y = 0x0a; y >= 0; y--) sum ^= mem8[u16(loc_aace + y)];
    mem8[loc_16c] = sum;
    // Copy three doubled entries into the output block.
    let x = mem8[loc_cde5];
    mem8[loc_38] = 0x02;
    for (;;) {
      const idx = u8(mem8[u16(loc_61b + mem8[loc_38])] << 1);
      mem8[u16(loc_2f60 + x)] = mem8[u16(loc_31fa + idx)];
      x = u8(x + 2);
      mem8[loc_38] = u8(mem8[loc_38] - 1);
      if (mem8[loc_38] & 0x80) break;
    }
  }

  loc_df39(m, 0x2f, 0x60);
  if (mem8[loc_123] & 0x80) loc_ab14(m, 0x36);
  if (mem8[loc_00] !== 0x18) return;
  if (!(mem8[loc_5] & 0x80)) return;
  if (mem8[u16(loc_102 + mem8[loc_3d])] !== 0) {
    loc_ab14(m, 0x30);
    loc_b0c6(m, mem8[u16(loc_102 + mem8[loc_3d])]);
  }
  loc_ab14(m, 0x3a);
  loc_ab14(m, 0x38);
}
