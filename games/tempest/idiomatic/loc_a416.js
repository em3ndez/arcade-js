// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_116, loc_302, loc_30a, loc_312, loc_a448, loc_a44e } from "./names.js";

// If the pending flag is clear, do nothing. Otherwise clear it and advance every
// live slot's counter by its per-type step; a slot that reaches its per-type limit
// is freed, any slot still short re-raises the pending flag for the next pass.
export function loc_a416(m) {
  const { mem8 } = m;
  if (mem8[loc_116] === 0) return;
  mem8[loc_116] = 0;
  for (let i = 7; i >= 0; i--) {
    if (mem8[u16(loc_30a + i)] === 0) continue;
    const type = mem8[u16(loc_302 + i)];
    const next = u8(mem8[u16(loc_312 + i)] + mem8[u16(loc_a44e + type)]);
    mem8[u16(loc_312 + i)] = next;
    if (next < mem8[u16(loc_a448 + type)]) {
      mem8[loc_116] = u8(mem8[loc_116] + 1);
    } else {
      mem8[u16(loc_30a + i)] = 0;
    }
  }
}
