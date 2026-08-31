// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_5e1f } from "./loc_5e1f.js";
/**
 * sweepTargetSlotsForGrab — the B-slot proximity sweep.
 *
 * For each of `count` target slots it runs the proximity trigger against the current record.
 * When the trigger reports a grab (returns false) the sweep aborts immediately, matching the
 * skip that unwound past this routine. Otherwise it advances the target pointer by four and the
 * record pointer by 0x18 and moves to the next slot. The source pointer is fixed across slots.
 *
 * LIVE-OUT: none — the sweep is invoked as a tail delegate and its caller reloads its own
 * registers before reading anything, so the advanced pointers and counter are not consumed.
 */

export function sweepTargetSlotsForGrab(m, rec = m.regs.hl, source = m.regs.ix, target = m.regs.iy, count = m.regs.b) {
  for (let i = 0; i < count; i++) {
    if (!loc_5e1f(m, rec, source, target)) return; // grab hit -> abort the sweep
    target = u16(target + 0x04);
    rec = u16(rec + 0x18);
  }
}
