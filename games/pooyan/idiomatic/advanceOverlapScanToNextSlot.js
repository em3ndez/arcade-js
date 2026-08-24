// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_5fa2 } from "./loc_5fa2.js";
/**
 * advanceOverlapScanToNextSlot — the advance-and-loop latch of the six-slot overlap scan. It steps the record-index
 * pointer by one record and the geometry pointer by one stride, counts the slot down, then either
 * re-enters the scan pass for the next slot or completes the exhausted no-hit sweep.
 *
 * LIVE-OUT: a boolean — true on an exhausted sweep, else whatever the re-entered pass yields
 * (false = a hit whose caller-skip must unwind the caller's frame). The advanced pointers + slot
 * count are the pass's inputs (set before re-entry); the outer driver shadows them across the call.
 */

const INDEX_STRIDE = 4;
const GEOM_STRIDE = 0x18;

export function advanceOverlapScanToNextSlot(m, index = m.regs.ix, geom = m.regs.hl, slots = m.regs.b) {
  const nextIndex = u16(index + INDEX_STRIDE);
  const nextGeom = u16(geom + GEOM_STRIDE);
  const remaining = u8(slots - 1);

  // thread the advanced cursors + slot count into the re-entered pass, or finish the sweep
  if (remaining !== 0) {
    return (m.regs.ix = nextIndex, m.regs.hl = nextGeom, m.regs.b = remaining, m.regs.de = GEOM_STRIDE, loc_5fa2(m));
  }
  return (m.regs.ix = nextIndex, m.regs.hl = nextGeom, m.regs.b = 0, m.regs.de = GEOM_STRIDE, true);
}
