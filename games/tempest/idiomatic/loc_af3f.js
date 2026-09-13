// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { SLOT_METRIC, loc_2e, COUNT_GLYPH_COORD_TABLE } from "./names.js";
import { loc_b0d1 } from "./loc_b0d1.js";
import { loc_ab0d } from "./loc_ab0d.js";
import { loc_df75 } from "./loc_df75.js";
import { loc_af71 } from "./loc_af71.js";
import { loc_b56a } from "./loc_b56a.js";
import { loc_ab98 } from "./loc_ab98.js";
import { loc_aa9e } from "./loc_aa9e.js";

// Draw one slot: skip it when empty, else emit its capped count at the slot's screen position.
export function loc_af3f(m, x = m.regs.x) {
  const { mem8 } = m;
  const count = mem8[u16(SLOT_METRIC + x)];
  if (count === 0) return;
  mem8[loc_2e] = x;
  loc_b0d1(m, 0x03);
  loc_ab0d(m);
  loc_df75(m, 0xd0, mem8[u16(COUNT_GLYPH_COORD_TABLE + mem8[loc_2e])]);
  loc_af71(m, count);
  loc_b56a(m, 0xa0);
  loc_ab98(m, 0x04, 0x10);
  loc_aa9e(m, mem8[loc_2e]);
}
