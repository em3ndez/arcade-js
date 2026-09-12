// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_74, loc_75 } from "./names.js";
import { loc_c774 } from "./loc_c772.js";

// Alt entry: lay a fixed two-byte header at the cursor start, then resume the shared
// vector build from cursor slot two.
export function loc_c765(m, x = m.regs.x) {
  const { mem8 } = m;
  const base = mem8[loc_74] | (mem8[loc_75] << 8);
  mem8[u16(base + 0)] = 0x00;
  mem8[u16(base + 1)] = 0x71;
  return loc_c774(m, x, 2);
}
