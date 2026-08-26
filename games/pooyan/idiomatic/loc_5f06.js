// SPDX-License-Identifier: GPL-3.0-only
import { loc_5ebd } from "./loc_5ebd.js";
import { u16 } from "../../../core/int.js";

const ACTOR_STRIDE = 0x04; // IX advance: one actor record
const RECORD_STRIDE = 0x18; // HL advance: one sprite/object row

/**
 * loc_5f06 — tail of the actor sweep loop: steps the actor and row pointers, then re-enters the
 * loop body while slots remain, passing the cursors/target/count straight through (LIVE-OUT: none).
 */
export function loc_5f06(m, hl = m.regs.hl, ix = m.regs.ix, count = m.regs.b, iy = m.regs.iy) {
  const remaining = (count - 1) & 0xff; // djnz
  if (remaining === 0) return;
  return loc_5ebd(m, u16(hl + RECORD_STRIDE), u16(ix + ACTOR_STRIDE), iy, remaining);
}
