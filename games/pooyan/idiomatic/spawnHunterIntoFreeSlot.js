// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_119a } from "./loc_119a.js";
/**
 * spawnHunterIntoFreeSlot — the enemy-spawn SLOT SWEEP.
 *
 * WHAT IT IS
 * ----------
 * Enemies in Pooyan live in a fixed pool of ACTOR RECORDS: 0x18-byte (24-byte) blocks in work
 * RAM laid end to end, one per possible on-screen enemy, starting at the first enemy record
 * (0x8ae0). A new enemy is never made from nothing — an empty slot is RECLAIMED and stamped with
 * the opening state of a fresh actor. This routine is the bare SCAN that walks that pool: it
 * visits records one stride apart and hands each to the per-record spawn initialiser, which
 * activates the first genuinely free one it is offered.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * It is the populate step of the spawn subsystem. It is reached two ways: the throttled spawn
 * cadence runs it only once its countdown has drained to zero and the wave budget still allows a
 * new enemy, and the commit into the in-play sub-state tail-runs it to fill the board. The caller
 * supplies three things — how many records to consider (count), where the pool begins (rec), and
 * an activation index that governs how much of the sweep survives once a slot has been claimed.
 *
 * HOW IT SETTLES ON ONE SLOT
 * --------------------------
 * Every record is offered to the initialiser with the fixed spawn entry Y-position seed 0x1d. The
 * initialiser reports back whether the record it was handed was ALREADY LIVE:
 *   - already live  → nothing was done; the scan slides on to the next record,
 *   - just seeded   → a fresh enemy was stamped into that record.
 * On a seed the remaining-record count is reloaded from the activation index, so what is left of
 * the sweep is then governed by that index rather than the incoming count — and that is what makes
 * the sweep claim a single free slot and stop rather than seeding every empty record it could still
 * reach. If every record is already live the sweep just runs its count out having changed nothing.
 *
 * ROM 0x118d-0x1199. Grounding: [seen].
 *
 * LIVE-OUT: memory only, all of it written inside the per-record initialiser on the one pass that
 * claims a slot — the seeded record's fields (liveness header, opening state index, the seeded Y,
 * cleared per-frame scratch, the facing pair, and the animation stream), the reseeded enemy
 * spawn-cadence timer, and the two spawn tallies (the per-wave active-enemy budget and the
 * never-reset cumulative spawn total). This routine itself leaves nothing load-bearing in
 * registers — the count and the record pointer both end as scratch.
 */

// The Y coordinate every freshly spawned enemy is seeded with: the fixed screen entry position,
// handed to the initialiser alongside each record it is offered.
const POSITION_SEED = 0x1d;

// Distance in bytes between consecutive actor records in the pool. Each record is a 24-byte block,
// so the scan steps the record pointer by this stride to reach the next slot.
const RECORD_STRIDE = 24;

export function spawnHunterIntoFreeSlot(m, count = m.regs.b, rec = m.regs.ix, activationIndex = m.regs.c) {
  // SET UP THE SWEEP. `remaining` is the slot-count budget, kept to 8 bits the way the hardware
  // loop counter wraps; `record` is the running pointer into the actor pool. Both come straight
  // from what the caller handed in (the slot count and the pool base).
  let remaining = count & 0xff;
  let record = u16(rec);
  do {
    // OFFER THIS RECORD TO THE INITIALISER (ROM 0x118d-0x1194). Hand the current record and the
    // fixed spawn Y-seed (0x1d) to the per-record spawn initialiser. It leaves an already-live
    // record untouched and reports that back; on a free record it stamps in a whole fresh enemy.
    // The reported value is the record's PRIOR liveness — true = it was already active, false =
    // this pass just seeded it.
    const alreadyActive = loc_119a(m, record, POSITION_SEED);

    // A SLOT WAS CLAIMED (ROM 0x118d loop control). When the record was free and has just been
    // seeded, reload the remaining count from the activation index. From here the number of further
    // records the sweep visits is set by that index instead of the original slot count — which is
    // how the sweep claims one free slot and then winds the loop down, rather than going on to seed
    // every empty record it would otherwise still reach this pass.
    if (!alreadyActive) remaining = activationIndex & 0xff; // on the seed path, count comes from the activation index

    // ADVANCE TO THE NEXT RECORD (ROM 0x1192-0x1196). Step the pointer one 24-byte stride forward
    // to the next actor block, wrapping to 16 bits the way the address register does.
    record = u16(record + RECORD_STRIDE);

    // COUNT DOWN AND REPEAT (ROM 0x1197-0x1199). Drop the 8-bit slot budget by one and loop while it
    // is still non-zero; when it reaches zero the sweep is finished and control returns to the caller.
    remaining = (remaining - 1) & 0xff; // djnz
  } while (remaining !== 0);
}
