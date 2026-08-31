// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_5e1f } from "./loc_5e1f.js";
/**
 * sweepTargetSlotsForGrab — the B-slot grab proximity sweep.
 *
 * WHAT IT IS
 *   The inner loop of the per-frame grab collision scan (ROM 0x5e11-0x5e1e). Once a frame the
 *   collision pipeline decides a grab is worth testing — a grab is not already latched, and no
 *   formation or wave-teardown is busy — and seeds a fixed reference object plus a target-coordinate
 *   pointer, a record pointer, and a slot count. This sweep then walks the slots one at a time,
 *   asking the per-slot grab trigger "has this record caught the reference object?" for each.
 *
 *   The reference object is Pooyan's arrow/rope tip; a "grab" is the moment that tip reaches a
 *   hanging object and catches it. Only one catch happens at a time, so the instant the trigger
 *   reports a hit the sweep stops looking at the remaining slots.
 *
 * ROLE IN THE MACHINE
 *   For each of `count` slots it runs the per-slot grab trigger against the current record. On a
 *   "no grab" result it advances the pointers and steps to the next slot; on a "grab hit" result it
 *   abandons the sweep for the whole frame. The trigger does all the mutation — raising the grab
 *   latch, snapping the caught record into its landing animation, and firing the grab sound — so
 *   this routine only drives the iteration and the early-out.
 *
 * ARGUMENTS (all point at live records, seeded by the caller)
 *   rec    -- the record under test. Its header byte gates the trigger and, on a hit, it is the
 *             record that becomes the caught object. Advances one 0x18-byte record per slot.
 *   source -- the fixed reference object supplying the catch-window centre (its X at +0, Y at +2).
 *             The SAME object is tested against every slot, so this pointer never moves.
 *   target -- the per-slot target coordinate measured against that centre (its X at +0, Y at +2).
 *             Advances one stride-4 slot per iteration.
 *   count  -- how many slots to sweep (three, in the one live caller).
 *
 * GROUNDING: [seen]
 *
 * LIVE-OUT: none. The advanced pointers and the counter die here — the master per-frame actor
 * updater that runs this pass reads nothing back from it; every effect of a grab is left in the
 * records and in the grab latch by the trigger itself.
 */

export function sweepTargetSlotsForGrab(m, rec = m.regs.hl, source = m.regs.ix, target = m.regs.iy, count = m.regs.b) {
  // Sweep `count` slots in order. Each slot pairs one record (rec) with one target coordinate
  // (target); the reference object (source) is shared by every slot and stays fixed.
  for (let i = 0; i < count; i++) {
    // Run the per-slot grab trigger for this slot. It returns true on every "no grab" path — an
    // empty or ineligible record, or a target coordinate sitting outside the source object's small
    // catch window — and false the instant a catch connects. Because a catch is a one-at-a-time
    // event, a false result ends the whole sweep for this frame right away.
    if (!loc_5e1f(m, rec, source, target)) return; // grab hit -> abort the sweep
    // No grab on this slot: step to the next one. The target coordinates are stride-4 records, so
    // the target pointer advances by 0x04...
    target = u16(target + 0x04);
    // ...and the records under test are 0x18-byte (24-byte) actor records, so the record pointer
    // advances by one whole record. `source` is deliberately left where it is.
    rec = u16(rec + 0x18);
  }
}
