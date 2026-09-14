// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { DRAW_CURSOR_LO, DRAW_CURSOR_HI } from "./names.js";
import { emitObjectPositionRecord } from "./emitObjectPositionVector.js";

// Alt entry: lay a fixed two-byte header at the cursor start, then resume the shared
// vector build from cursor slot two.
export function layHeaderAndBuildRecord(m, x = m.regs.x) {
  const { mem8 } = m;
  const base = mem8[DRAW_CURSOR_LO] | (mem8[DRAW_CURSOR_HI] << 8);
  mem8[u16(base + 0)] = 0x00;
  mem8[u16(base + 1)] = 0x71;
  return emitObjectPositionRecord(m, x, 2);
}
