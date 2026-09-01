// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_1590 } from "./loc_1590.js";

// Count in C the 0x10 steps that lift A to/above threshold H; a negative A is normalized up first.
export function loc_1554(m, a = m.regs.a, h = m.regs.h) {
  let c = 0;
  if (a >= h) [a, c] = loc_1590(m, a, c);
  while (a < h) {
    a = u8(a + 0x10);
    c = u8(c + 1);
  }
  // Carry exits CLEAR (A has reached/passed H); it is a live-out the callers read, so clear it explicitly.
  return [(m.regs.a = a), (m.regs.c = c), (m.regs.fC = false)];
}
