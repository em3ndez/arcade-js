// SPDX-License-Identifier: GPL-3.0-only
import { blockCopy } from "./blockCopy.js";
import { u16 } from "../../../core/int.js";
import { loc_1d20 } from "./names.js";

// Replicate the 0x2c-byte source block into four consecutive destination slots; live-out HL is the end.
export function loc_01f8(m, hl = m.regs.hl) {
  let dst = hl;
  for (let pass = 0; pass < 4; pass++) {
    blockCopy(m, loc_1d20, dst, 0x2c);
    dst = u16(dst + 0x2c);
  }
  return (m.regs.hl = dst);
}
