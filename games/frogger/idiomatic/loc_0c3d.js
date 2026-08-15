// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0c3d — draw the two-digit intro pair into a work-RAM row: low digit then high, via the
 * row-draw helper twice. A zero digit draws nothing. LIVE-OUT: memory-only.
 */
import { loc_83fb } from "./names.js";
import { loc_0c4a } from "./loc_0c4a.js";

const RAM_PAGE = 0x80;
const ROW_BASE = 48;
const DIGIT_BYTE = 4;

export function loc_0c3d(m) {
  const { regs, mem16 } = m;
  regs.h = RAM_PAGE;
  regs.bc = mem16[loc_83fb]; // digit pair, low digit first
  regs.d = ROW_BASE;
  regs.e = DIGIT_BYTE;

  loc_0c4a(m);

  regs.c = regs.b; // draw the high digit next
  return loc_0c4a(m);
}
