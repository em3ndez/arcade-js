// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  loc_38, loc_39a, loc_3ac, loc_435, loc_445, loc_56, loc_57, loc_58,
  loc_60ca, loc_74, loc_75, loc_a9, loc_3db2, loc_3db3, loc_cec8, loc_cec9,
} from "./names.js";
import { loc_c453 } from "./loc_c453.js";
import { loc_c098 } from "./loc_c098.js";
import { loc_c73c } from "./loc_c73c.js";
import { loc_bd3e } from "./loc_bd3e.js";

// Emit a vector-list entry for the active slot. When its kind byte is zero, write four
// blank/marker pairs; otherwise seat the scratch inputs, run the delta passes, then append
// either a randomly chosen table word or a fixed marker word, advancing the write cursor.
export function loc_c6c7(m) {
  const { mem8 } = m;
  const x = mem8[loc_38];
  const base = mem8[loc_74] | (mem8[loc_75] << 8);

  if (mem8[u16(loc_3ac + x)] === 0) {
    // Inactive slot: four blank+0x71 pairs from the current cursor.
    let y = mem8[loc_a9];
    for (let i = 0; i < 4; i++) {
      mem8[u16(base + y)] = 0x00; y = u8(y + 1);
      mem8[u16(base + y)] = 0x71; y = u8(y + 1);
    }
    mem8[loc_a9] = y;
    return;
  }

  // Active slot: seat scratch fields and run the delta/coprocessor passes.
  mem8[loc_57] = mem8[u16(loc_3ac + x)];
  loc_c453(m);
  mem8[loc_56] = mem8[u16(loc_435 + x)];
  mem8[loc_58] = mem8[u16(loc_445 + x)];
  loc_c098(m);
  loc_c73c(m);

  const kind = mem8[u16(loc_39a + mem8[loc_38])] & 0x40;
  let y = mem8[loc_a9];
  if (kind !== 0) {
    // Randomized word: a random even offset selects one of two adjacent table words.
    loc_bd3e(m);
    const idx = (mem8[loc_60ca] & 0x02) + 0x1c;
    mem8[u16(base + u8(y + 1))] = mem8[u16(loc_cec9 + idx)];
    mem8[u16(base + y)] = mem8[u16(loc_cec8 + idx)];
    mem8[loc_a9] = u8(y + 2);
    return;
  }

  // Fixed marker word.
  mem8[u16(base + y)] = 0x00; y = u8(y + 1);
  mem8[u16(base + y)] = 0x68; y = u8(y + 1);
  mem8[u16(base + y)] = mem8[loc_3db2]; y = u8(y + 1);
  mem8[u16(base + y)] = mem8[loc_3db3]; y = u8(y + 1);
  mem8[loc_a9] = y;
}
