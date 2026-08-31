// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_2be5 } from "./loc_2be5.js";
/**
 * scanFormationSlotsAndLaunchFree — the formation-spawn scan: launch at most one new
 * formation object per pass, into the first free slot it finds.
 *
 * WHAT IT IS
 *   A single sweep over the formation spawn record table. It walks up to 0x11 (SLOT_COUNT)
 *   records, handing each one in turn to the per-slot launcher (loc_2be5). That launcher
 *   reports back whether the slot it receives is already occupied: a busy slot leaves the
 *   walk running on to the next record; the first FREE slot is seeded with a brand-new
 *   formation object and the walk stops right there. So one whole sweep either finds an
 *   opening and launches exactly one object, or runs the table out having launched none
 *   (every slot busy). It never launches more than one object per pass.
 *
 * ROLE IN THE MACHINE
 *   Formation objects are the enemies that stream into the play field wave after wave. A
 *   separate countdown (FORMATION_SPAWN_TIMER, 0x8d30) paces the launches; when that timer
 *   expires the formation-spawn tick seats this scan's pointer and stride and runs it, so
 *   this scan is the step that turns "the spawn timer fired" into "one more object has
 *   entered the field". The records live in FORMATION_SPAWN_TABLE (0x8c60), 0x18 bytes
 *   apart, and the scan steps DOWNWARD through them — the stride is the two's-complement of
 *   0x18, so each pass subtracts one record's width from the pointer.
 *
 * ROM ADDRESS: 0x2bb3–0x2bbe.
 *
 * GROUNDING: [seen] — the scan and the table it walks are observed together. The record
 *   base FORMATION_SPAWN_TABLE (0x8c60) and the per-slot launcher loc_2be5 (0x2be5) are
 *   [seen], as are the cells that launcher touches: the wave arrival counter (0x8903) and
 *   the spawn countdown (0x8d30).
 *
 * ENTRY: two paths reach this scan, and both seat the same two registers before it runs —
 *   the table pointer (rec, IX) and the descending stride (stride, DE = 0xffe8, i.e. −0x18).
 *   It is entered by fallthrough from the formation-spawn tick
 *   (tickFormationSpawnAndScanSlots, 0x2b9a), which on timer expiry points IX at the record
 *   base FORMATION_SPAWN_TABLE (0x8c60), and by a jump entry from
 *   checksumIntegrityStripAndDispatchSpawn (0x2b59).
 *
 * LIVE-OUT (memory only — the caller reads back no register): on a launch, everything the
 *   per-slot launcher writes — the claimed record's fields, WAVE_ARRIVAL_COUNTER (0x8903)
 *   decremented by one, and FORMATION_SPAWN_TIMER (0x8d30) reloaded with the next
 *   inter-launch delay. A sweep that launches nothing writes nothing.
 */

const SLOT_COUNT = 0x11; // 0x11 records visited per sweep — the length of FORMATION_SPAWN_TABLE (0x8c60)

export function scanFormationSlotsAndLaunchFree(m, rec = m.regs.ix, stride = m.regs.de) {
  // Begin the walk at the table base handed in through IX. `stride` (DE) is the signed step
  // between consecutive records — 0xffe8 (−0x18), so each pass moves one record's width
  // DOWN the table (FORMATION_SPAWN_TABLE, 0x8c60).
  let cursor = rec;

  // Visit at most SLOT_COUNT (0x11) records. The first free slot wins the launch and ends
  // the sweep, so this loop only ever runs to completion when every slot is busy.
  for (let remaining = SLOT_COUNT; remaining > 0; remaining--) {
    // Offer the record at the cursor to the per-slot launcher (loc_2be5, 0x2be5). Its
    // boolean answer is the scan-control signal: true = the slot is busy, so keep scanning;
    // false = it just seeded a fresh formation object into this free slot, so the sweep is
    // finished — bail out here, enforcing at most one launch per pass.
    if (!loc_2be5(m, cursor)) return; // slot launched -> abort the scan

    // Slot is busy: advance the pointer one record down the table. Adding the negative
    // stride and wrapping to 16 bits (u16) lands on the next-lower record address, then the
    // loop tries that record.
    cursor = u16(cursor + stride);
  }
  // Ran off the end of the table with every slot busy — this pass launched nothing.
}
