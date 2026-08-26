// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_6069 } from "./loc_6069.js";
/**
 * loc_60f2 — outer-scan epilogue: step to the next actor/record pair and re-enter the scan.
 *
 * Advances the actor pointer by one slot and the record pointer by one record, decrements the
 * remaining count, and re-enters the scan head while records remain. When the count drains the
 * scan is complete.
 *
 * LIVE-OUT: a boolean forwarded from the scan — true = normal completion (no frame abort),
 * false = a caller-skip must unwind the caller's frame. No register survives.
 */
const ACTOR_STRIDE = 0x04;
const RECORD_STRIDE = 0x18;

export function loc_60f2(m, hl = m.regs.hl, ix = m.regs.ix, count = m.regs.b, iy = m.regs.iy, ireg = m.regs.i) {
  const remaining = (count - 1) & 0xff;
  if (remaining === 0) return true; // every record scanned, no hit
  return loc_6069(m, u16(hl + RECORD_STRIDE), u16(ix + ACTOR_STRIDE), remaining, iy, ireg);
}
