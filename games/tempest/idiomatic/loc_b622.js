// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ENEMY_SEGMENT, FRAME_COUNTER } from "./names.js";
import { loc_bcfd } from "./loc_bcfd.js";

// Pick slot x's table index, add a four-phase animation offset, and emit that pair.
export function loc_b622(m, x = m.regs.x) {
  const { mem8 } = m;
  const y = mem8[u16(ENEMY_SEGMENT + x)];
  const a = (((mem8[FRAME_COUNTER] & 0x03) << 1) + 0x12) & 0xff;
  return loc_bcfd(m, a, y);
}
