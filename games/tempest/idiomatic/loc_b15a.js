// SPDX-License-Identifier: GPL-3.0-only
import { loc_56, loc_57, loc_37, loc_14d, loc_14e, loc_16e } from "./names.js";
import { loc_df6c } from "./loc_df6c.js";
import { loc_df4c } from "./loc_df4c.js";
import { loc_df39 } from "./loc_df39.js";
import { loc_ab17 } from "./loc_ab17.js";

// Stash the two inputs, then walk a cursor from the low bound to the high bound in
// steps of two, emitting three vector words per step (a header, a per-step marker
// whose value depends on the cursor's position, and the stashed pair). Then draw
// two fixed trailer words.
export function loc_b15a(m, a = m.regs.a, x = m.regs.x) {
  const { mem8 } = m;
  mem8[loc_57] = a;
  mem8[loc_56] = x;
  mem8[loc_37] = mem8[loc_14d];
  mem8[loc_16e] = mem8[loc_16e] - 1;
  do {
    const cur = mem8[loc_37];
    loc_df6c(m, cur >> 5, (cur << 2) & 0x7f);
    let marker;
    if (cur === mem8[loc_14d]) {
      marker = 0x00;
    } else {
      const seg = (cur >> 3) & 0x07;
      marker = seg === 0x07 ? 0x03 : seg;
    }
    loc_df4c(m, 0x68, marker);
    loc_df39(m, mem8[loc_57], mem8[loc_56]);
    mem8[loc_37] = mem8[loc_37] + 2;
  } while (mem8[loc_37] < mem8[loc_14e]);
  loc_ab17(m, 0xd0, 0x2c);
  loc_df39(m, 0x3f, 0xf2);
}
