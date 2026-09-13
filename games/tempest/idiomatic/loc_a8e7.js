// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  GAME_MODE, STATUS_FLAGS, TABLE_CURSOR, WORK_PTR_LO, WORK_PTR_HI, loc_3d, ACTIVE_SLOT_COUNT,
  loc_43, loc_44, loc_45, loc_102, SPIKED_SEGMENT_COUNT, DECIMAL_MODE_FLAG, VEC_GLYPH_BUFFER,
  CHAR_GLYPH_TABLE, loc_61b, SELFCHECK_XOR_BYTES, GLYPH_LIST_BUF_OFS, MIRROR_COPY_BUF_OFS,
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
  if (mem8[STATUS_FLAGS] & 0x80) skipSecond = mem8[ACTIVE_SLOT_COUNT] === 0;
  else skipSecond = (mem8[loc_43] | mem8[loc_44] | mem8[loc_45]) === 0;
  if (!skipSecond) loc_a97f(m, 0x01, 0x01);

  if (mem8[GAME_MODE] !== 0x04) {
    mem8[WORK_PTR_LO] = 0x1d;
    mem8[WORK_PTR_HI] = 0x07;
    loc_a9d7(m, mem8[GLYPH_LIST_BUF_OFS]);
    // Fold a fixed span into one checksum byte.
    let sum = 0xa7;
    for (let y = 0x0a; y >= 0; y--) sum ^= mem8[u16(SELFCHECK_XOR_BYTES + y)];
    mem8[DECIMAL_MODE_FLAG] = sum;
    // Copy three doubled entries into the output block.
    let x = mem8[MIRROR_COPY_BUF_OFS];
    mem8[TABLE_CURSOR] = 0x02;
    for (;;) {
      const idx = u8(mem8[u16(loc_61b + mem8[TABLE_CURSOR])] << 1);
      mem8[u16(VEC_GLYPH_BUFFER + x)] = mem8[u16(CHAR_GLYPH_TABLE + idx)];
      x = u8(x + 2);
      mem8[TABLE_CURSOR] = u8(mem8[TABLE_CURSOR] - 1);
      if (mem8[TABLE_CURSOR] & 0x80) break;
    }
  }

  loc_df39(m, 0x2f, 0x60);
  if (mem8[SPIKED_SEGMENT_COUNT] & 0x80) loc_ab14(m, 0x36);
  if (mem8[GAME_MODE] !== 0x18) return;
  if (!(mem8[STATUS_FLAGS] & 0x80)) return;
  if (mem8[u16(loc_102 + mem8[loc_3d])] !== 0) {
    loc_ab14(m, 0x30);
    loc_b0c6(m, mem8[u16(loc_102 + mem8[loc_3d])]);
  }
  loc_ab14(m, 0x3a);
  loc_ab14(m, 0x38);
}
