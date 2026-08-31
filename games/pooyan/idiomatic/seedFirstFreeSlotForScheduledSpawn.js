// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { initSpawnedActorRecordAndDeriveSpeed } from "./initSpawnedActorRecordAndDeriveSpeed.js";
import { SPAWN_SEQUENCE_INDEX_8D13, SPAWN_KIND_TABLE_5647 } from "./names.js";
/**
 * seedFirstFreeSlotForScheduledSpawn — find the first empty actor record in a pool and bring one
 * new actor to life in it.
 *
 * WHAT IT IS
 *   The tail of spawn scheduler B (ROM 0x5544-0x5563). Grounding: [seen]. Every moving thing in
 *   Pooyan — a hunter, an arrow, an eagle, a falling chunk of meat — lives as a fixed-size record
 *   inside a pool of records in work RAM. Introducing a new actor means finding a record nobody is
 *   using and filling it in. This routine is that "claim the first free record and initialise it"
 *   step: it walks a pool, stops at the first free slot, decides WHICH KIND of actor belongs there,
 *   and hands the slot to the shared actor constructor to finish the job.
 *
 * ROLE IN THE MACHINE
 *   Scheduler B (ROM 0x5519, which flows straight into this scan) is one of the periodic spawners.
 *   It is throttled by a per-type countdown; each time that countdown reaches zero it advances a
 *   rotating spawn-sequence cursor and then runs this scan pointed at the spawned-object record
 *   pool. Because the cursor advances on every fire, consecutive spawns cycle through the scheduled
 *   kinds of actor. A record counts as OCCUPIED while either of its first two header bytes is
 *   nonzero, and FREE once both are zero; the scan steps over occupied records and claims the first
 *   free one. Exactly one new actor is born per call.
 *
 * PARAMETERS (the scheduler front-end sets these before the scan begins)
 *   base   — start address of the record pool (scheduler B aims it at the spawned-object table)
 *   stride — the record size in bytes (0x18), i.e. the step from one record to the next
 *   count  — how many records to examine before giving up
 *
 * LIVE-OUT
 *   Memory only. On a successful spawn the chosen kind byte is stamped into the claimed record's
 *   +0x17 field, and the actor constructor then writes the record's opening state, look, and speed
 *   fields. No register carries a result. If no record in the pool is free, the pool is left
 *   untouched and nothing is spawned this pass.
 */

// Record-field offsets and seed values used once a free record is claimed. An actor record is a flat
// run of bytes; the constants below name the two fields this routine writes plus the mask that turns
// the rotating cursor into a kind-table index.
const KIND_FIELD = 0x17; //       record +0x17: the kind/script code; the actor constructor reads it back to pick the matching animation and speed row
const KIND_INDEX_MASK = 0x0f; //  the rotating spawn-sequence cursor is taken modulo 16 (its low nibble) to index the kind table
const SPAWN_FIELD_VALUE = 0x0f; // per-spawn datum handed to the actor constructor, which stamps it into the record's +0x06 field for this spawner

export function seedFirstFreeSlotForScheduledSpawn(m, base = m.regs.ix, stride = m.regs.de, count = m.regs.b) {
  // mem8 is the byte-addressed view of work RAM: the actor pool and the spawn-sequence cursor both live here.
  const { mem8 } = m;

  // Walk the pool from `base`, one record every `stride` bytes, for at most `count` records (ROM
  // 0x5544: the scan loop). Occupied records are stepped over; the first free record wins.
  let cursor = base;
  for (let i = 0; i < count; i++) {
    // A record is occupied while either of its first two header bytes is nonzero (ROM 0x5545-0x554b:
    // read +0x00, OR in +0x01). Both bytes zero marks a free slot ready to receive a new actor.
    const live = (mem8[cursor] | mem8[u16(cursor + 1)]) !== 0;
    if (!live) {
      // Free record found. Pick which kind of actor to spawn from the rotating spawn-sequence cursor
      // at 0x8d13 (ROM 0x5555): its low nibble is the index into the kind table. The scheduler
      // front-end advanced this cursor when the cadence fired, so successive spawns rotate through
      // the scheduled kinds.
      const idx = mem8[SPAWN_SEQUENCE_INDEX_8D13] & KIND_INDEX_MASK;
      // Read the kind/script code out of the ROM kind table at 0x5647, indexed by that cursor
      // position (ROM 0x5552-0x5558 table lookup).
      const [kindByte] = fetchByteFromTableIndex(m, SPAWN_KIND_TABLE_5647, idx);
      // Stamp the chosen kind into the record's +0x17 field (ROM 0x5558) so the actor constructor can
      // read it back and select the actor's animation and speed.
      mem8[u16(cursor + KIND_FIELD)] = kindByte;
      // Hand the free record to the shared actor constructor (initSpawnedActorRecordAndDeriveSpeed, ROM 0x555b). It marks the
      // record live (+0x00 = 1), seeds the opening state fields, writes SPAWN_FIELD_VALUE into +0x06,
      // installs the animation and an initial signed speed, and finishes the spawn. The constructor
      // always reports back false, so this guard returns at once — a single spawn ends the whole
      // scan, guaranteeing exactly one record is claimed per call.
      if (!initSpawnedActorRecordAndDeriveSpeed(m, cursor, SPAWN_FIELD_VALUE)) return; // one record seeded -> stop scanning this pass
    }
    // Occupied record: advance to the next record in the pool and keep looking (ROM 0x555f-0x5561).
    cursor = u16(cursor + stride);
  }
  // Fell out of the loop: no free record in the pool, so nothing is spawned this pass (ROM 0x5563 ret).
}
