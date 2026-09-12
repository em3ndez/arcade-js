// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  loc_37, loc_56, loc_57, loc_58, loc_5b, loc_5f, loc_68, loc_69,
  loc_6a, loc_6b, loc_6c, loc_6d, loc_73, loc_76, loc_77, loc_9e,
  loc_202, loc_263, loc_283, loc_2a3,
} from "./names.js";
import { loc_df39 } from "./loc_df39.js";
import { loc_df4a } from "./loc_df4a.js";
import { loc_df4c } from "./loc_df4c.js";
import { loc_df6a } from "./loc_df6a.js";
import { loc_df6c } from "./loc_df6c.js";
import { loc_df09 } from "./loc_df09.js";
import { loc_b56a } from "./loc_b56a.js";
import { loc_b944 } from "./loc_b944.js";
import { loc_b955 } from "./loc_b955.js";
import { loc_b967 } from "./loc_b967.js";
import { loc_c098 } from "./loc_c098.js";
import { loc_c3ba } from "./loc_c3ba.js";
import { loc_c772 } from "./loc_c772.js";

// Reset the accumulators and seeds, cache the base pointer pair, then for each active
// slot from the top down: integrate its deltas, emit its record with header and shadow,
// and close the frame by swapping pointers back and drawing the base list.
export function loc_b8ba(m) {
  const { mem8 } = m;
  loc_df39(m, 0x3f, 0xf2);
  mem8[loc_6a] = 0x00;
  mem8[loc_6b] = 0x00;
  mem8[loc_6c] = 0x00;
  mem8[loc_6d] = 0x00;
  mem8[loc_202] = 0x00;
  mem8[loc_68] = 0x00;
  mem8[loc_69] = 0x00;
  mem8[loc_5f] = 0xe0;
  mem8[loc_5b] = 0xff;
  {
    const [a, x] = loc_b967(m);
    mem8[loc_77] = a;
    mem8[loc_76] = x;
  }
  mem8[loc_37] = 0x0f;
  do {
    const x = mem8[loc_37];
    const active = mem8[u16(loc_283 + x)];
    if (active !== 0) {
      mem8[loc_57] = active;
      mem8[loc_56] = mem8[u16(loc_263 + x)];
      mem8[loc_58] = mem8[u16(loc_2a3 + x)];
      loc_c098(m);
      mem8[loc_73] = 0x00;
      loc_b944(m);
      loc_c3ba(m);
      loc_b56a(m, 0xa0);
      loc_b944(m);
      loc_c772(m, 0x61);
      const [pa, py] = loc_b955(m);
      loc_df6c(m, pa, py);
      let phase = mem8[loc_37] & 0x07;
      if (phase === 0x07) phase = 0x00;
      mem8[loc_9e] = phase;
      loc_df4c(m, 0x08, phase);
      loc_df4a(m, 0x00);
      const [ha, hx] = loc_b967(m);
      loc_df39(m, ha, hx);
    }
    const next = (mem8[loc_37] - 1) & 0xff;
    mem8[loc_37] = next;
    if (next & 0x80) break;
  } while (true);
  loc_b944(m);
  loc_df6a(m, 0x01);
  loc_df09(m);
  return loc_b944(m);
}
