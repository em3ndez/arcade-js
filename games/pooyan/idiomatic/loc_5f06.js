// SPDX-License-Identifier: GPL-3.0-only
import { loc_5ebd } from "./loc_5ebd.js";
import { u16 } from "../../../core/int.js";

const ACTOR_STRIDE = 0x04; // IX advance: one actor record
const RECORD_STRIDE = 0x18; // HL advance: one sprite/object row

/**
 * loc_5f06 — tail of the actor sweep loop.
 *
 * Steps the actor pointer one record and the row pointer one row, then continues the sweep while
 * slots remain; once the counter drains the sweep returns to its caller.
 *
 * LIVE-OUT: none — a void sweep tail. The advanced pointers, stride, and remaining count are
 * seated in the register bridge the loop body's recursive scan reads back.
 */
export function loc_5f06(m, hl = m.regs.hl, ix = m.regs.ix, count = m.regs.b) {
  const { regs } = m;
  const remaining = (count - 1) & 0xff; // djnz
  if (remaining === 0) return; // counter drained -> ret to the sweep caller
  regs.de = RECORD_STRIDE; // stride the loop body carries forward
  regs.ix = u16(ix + ACTOR_STRIDE);
  regs.hl = u16(hl + RECORD_STRIDE);
  regs.b = remaining;
  loc_5ebd(m); // next actor
}
