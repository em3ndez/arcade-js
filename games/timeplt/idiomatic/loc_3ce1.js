// SPDX-License-Identifier: GPL-3.0-only
/** loc_3ce1 — answer whether the byte at the head of the sprite entry a caller points at has arrived at the
 * wrap point. The test is a four-wide window that STRADDLES zero — the two values just short of the wrap and
 * the two from the wrap on — so it measures a wrapped distance and not a range, which is what lets a byte
 * stepping a few units at a time land inside it instead of over it. Nothing is written, and nothing here
 * establishes what the byte measures. LIVE-OUT: the answer, returned and mirrored into carry; memory untouched. */

import { u8 } from "../../../core/int.js";
import { F_C } from "../../../core/cpu/z80.js";

const WINDOW = 4;
const STARTS_BELOW_WRAP = 2;

export function loc_3ce1(m, spriteEntry = m.regs.iy) {
  const { mem8, regs } = m;
  const arrived = u8(mem8[spriteEntry] + STARTS_BELOW_WRAP) < WINDOW;
  regs.f = (regs.f & ~F_C) | (arrived ? F_C : 0);
  return arrived;
}
