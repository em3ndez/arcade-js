// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { initSpawnedActorRecordAndDeriveSpeed } from "./initSpawnedActorRecordAndDeriveSpeed.js";
import { ACTOR_SPAWN_TYPE_TABLE, SPAWN_TYPE_CURSOR } from "./names.js";

/**
 * seedFirstFreeActorBlockFromSpawnTypeTable — spawn-slot scan: seed one actor into the first free block.
 *
 * ROM 0x54f9-0x5518. Grounding: [seen].
 *
 * WHAT IT IS. Every moving thing in Pooyan — a hunter, an arrow, an eagle, a falling piece of meat —
 * lives in a fixed-layout record in work RAM, and new ones are brought into being by scanning the pool
 * for an empty record and filling it in place. This routine is one of those spawn paths. It walks a run
 * of `count` records starting at `base`, stepping `stride` bytes between them, and stops at the first
 * record that is currently free. For that record it decides WHAT KIND of actor to create — reading the
 * kind byte from the actor spawn-type table (ROM 0x5637, ACTOR_SPAWN_TYPE_TABLE) at the entry named by
 * the schedule cursor — stamps that kind into the record, and hands the record to the shared actor
 * constructor to be brought to life. Exactly one actor is created per call; if no record is free the
 * routine simply returns having changed nothing.
 *
 * ITS ROLE IN THE MACHINE. It is one of the actor allocators that feed the constructor tail initSpawnedActorRecordAndDeriveSpeed
 * (ROM 0x5489). Whichever spawn path finds a free slot writes the chosen kind into that slot's +0x17
 * kind field and calls into initSpawnedActorRecordAndDeriveSpeed, which finishes the record — marking it live, installing its
 * animation, seating a dwell countdown, and computing its starting speed. A successful spawn ends the
 * whole attempt, so this routine stops the walk the instant it has seeded one record.
 *
 * WHICH RECORD IS FREE. A record's first byte (+0x00) is its active flag: the per-frame actor sweep
 * only services records whose active flag is set. A record whose first two header bytes (+0x00 and
 * +0x01) are both zero has never been claimed, so the scan treats an all-zero header as the free slot.
 *
 * KIND SELECTION. The schedule cursor SPAWN_TYPE_CURSOR (RAM 0x8d12) advances as the round plays; its
 * low nibble (0..15) indexes ACTOR_SPAWN_TYPE_TABLE (ROM 0x5637) to pick the kind of actor due next.
 *
 * LIVE-OUT: memory only — the seeded record (its kind byte plus the fields the constructor writes).
 * Nothing reads a register back.
 */

const SEED_COUNT = 0x0b; // per-spawn count/parameter datum handed to the constructor; it lands in the new record's +0x06 field
const KIND_FIELD = 0x17; // record offset carrying the actor kind byte; the constructor reads it to pick the animation and speed

export function seedFirstFreeActorBlockFromSpawnTypeTable(m, base = m.regs.ix, stride = m.regs.de, count = m.regs.b) {
  const { mem8 } = m;

  // Set up the scan: start at the first record base (`base`, from IX) and count down `count` records
  // (from B). Each pass moves `stride` bytes (from DE) — the size of one actor record — to the next
  // record. The walk runs at least once and continues until either a free record is seeded or every
  // record has been examined.
  let cursor = base;
  let remaining = count;
  do {
    // Is this record free? OR its two header bytes together — the active flag (+0x00) and the byte at
    // +0x01. A zero result means both are clear, so the record has never been claimed and this is the
    // slot to seed. A non-zero result means the record is live, so fall through and keep walking.
    if ((mem8[cursor] | mem8[u16(cursor + 1)]) === 0) {
      // Choose the kind of actor to put here. Read the actor spawn-type table (ROM 0x5637) at the entry
      // selected by the low nibble of the schedule cursor (RAM 0x8d12); the fetched byte is the kind.
      const kind = fetchByteFromTableIndex(m, ACTOR_SPAWN_TYPE_TABLE, mem8[SPAWN_TYPE_CURSOR] & 0x0f)[0];
      // Stamp the chosen kind into the record's kind field (+0x17). The constructor keys both the
      // animation lookup (ROM 0x5657) and the speed lookup (ROM 0x55d7) off this byte.
      mem8[u16(cursor + KIND_FIELD)] = kind;
      // Bring the record to life through the shared constructor at ROM 0x5489, passing the per-spawn
      // count/parameter datum. One spawn ends the whole attempt, so return without walking further.
      initSpawnedActorRecordAndDeriveSpeed(m, cursor, SEED_COUNT); // seed the free block; returns to our caller
      return;
    }
    // Record was live: advance to the next record base (16-bit wrapped) and count this one off. The
    // remaining count decrements as an 8-bit value, wrapping at a byte, and the walk ends at zero.
    cursor = u16(cursor + stride);
    remaining = (remaining - 1) & 0xff;
  } while (remaining !== 0);
}
