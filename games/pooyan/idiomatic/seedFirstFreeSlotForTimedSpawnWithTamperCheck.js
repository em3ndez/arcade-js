// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { loc_5489 } from "./loc_5489.js";
import {
  SPAWN_SEQUENCE_INDEX_8D14,
  SPAWN_KIND_TABLE_5627,
  INTEGRITY_GUARD_REGION_0BAD,
  INTEGRITY_GUARD_SIGNATURE_55B5,
  TAMPER_FREEZE_FLAG,
} from "./names.js";
/**
 * seedFirstFreeSlotForTimedSpawnWithTamperCheck — the tail of the frame-timer enemy spawner.
 *
 * WHAT IT IS
 *   ROM 0x5594-0x55d3, grounding [seen]. This is the back half of one of Pooyan's actor
 *   spawners. New actors are allocated by scanning a pool of fixed-stride actor records for the
 *   first empty one and building it in place — at most one new actor per call. The front of the
 *   spawner runs a per-frame countdown; when that expires it runs this tail to actually place
 *   the actor, so spawns arrive on a timed cadence rather than every frame.
 *
 * ITS ROLE IN THE MACHINE
 *   Every actor record begins with a two-byte header, and a record whose header is all-zero is
 *   a free slot. This routine walks `count` records of `stride` bytes starting at `base`
 *   (defaulting to the IX/DE/B the caller set up), steps over every occupied slot, and stops at
 *   the first free one. There it does two things:
 *     1. an anti-tamper self-check on the program image, then
 *     2. it stamps the free record with a fresh actor "kind" drawn from a rotating cursor and
 *        hands the record to the shared actor initializer to finish the build.
 *   The rotating cursor makes successive spawns cycle through the wave's mix of actor kinds.
 *
 * THE ANTI-TAMPER SELF-CHECK
 *   Folded into the spawn is one of the ROM's scattered code-integrity tripwires. An eight-byte
 *   guard region (INTEGRITY_GUARD_REGION_0BAD, ROM 0x0bad) is summed byte-for-byte against a
 *   companion signature table (INTEGRITY_GUARD_SIGNATURE_55B5, ROM 0x55b5) whose bytes are the
 *   two's-complements of the guard, so on an untouched ROM every pair cancels to zero. Any pair
 *   that fails to cancel bumps the soft miss-tally TAMPER_FREEZE_FLAG (0x881e). That tally has
 *   teeth elsewhere: a nonzero value freezes spawning, aborts the lead actor's state machine,
 *   and suppresses the round-HUD build — so a patched image quietly degrades into a broken game
 *   rather than tripping a visible "you cheated" halt.
 *
 * LIVE-OUT: none — the routine's effects are all in memory (the seeded actor record and, on a
 *   tamper miss, the incremented 0x881e tally). It hands nothing back to its caller.
 */

// Actor-record field offsets and the control values this spawner writes.
const KIND_FIELD = 0x17; //       (ix+0x17): the kind/script byte the initializer reads to pick the actor's animation script and speed
const KIND_INDEX_MASK = 0x0f; //  the rotating spawn cursor is taken mod 16 to index the kind table
const SPAWN_FIELD_VALUE = 0x13; // handed to the initializer as the spawn-type field; it lands at (ix+0x06) of the new record
const GUARD_LEN = 0x08; //        the integrity guard region and its signature are eight bytes each

export function seedFirstFreeSlotForTimedSpawnWithTamperCheck(m, base = m.regs.ix, stride = m.regs.de, count = m.regs.b) {
  const { mem8 } = m;

  // Scan the actor pool (0x5594): `count` records of `stride` bytes, starting at `base`. Each
  // record's two-byte header (bytes +0 and +1) is its occupancy marker.
  let cursor = base;
  for (let i = 0; i < count; i++) {
    // A record is live while either header byte is nonzero; OR-ing the two collapses the pair to
    // a single occupancy test (0x5595-0x559b). Live records are stepped over so the scan lands on
    // the first genuinely empty slot.
    const live = (mem8[cursor] | mem8[u16(cursor + 1)]) !== 0;
    if (!live) {
      // Anti-tamper self-check (0x55a5): sum each byte of the eight-byte guard region at 0x0bad
      // against the matching byte of its two's-complement signature at 0x55b5. On an intact ROM
      // every pair sums to 0 (mod 256); the first pair that does not cancel flags a mismatch and
      // stops the loop early.
      let mismatch = false;
      for (let j = 0; j < GUARD_LEN; j++) {
        if (u8(mem8[u16(INTEGRITY_GUARD_REGION_0BAD + j)] + mem8[u16(INTEGRITY_GUARD_SIGNATURE_55B5 + j)]) !== 0) {
          mismatch = true;
          break;
        }
      }
      // A mismatch bumps the soft tamper miss-tally at 0x881e (0x55af). It is never reset in
      // normal play; downstream readers turn a nonzero tally into frozen spawns, aborted actor
      // updates, and a skipped HUD build.
      if (mismatch) mem8[TAMPER_FREEZE_FLAG] = u8(mem8[TAMPER_FREEZE_FLAG] + 1);

      // Choose this spawn's actor kind (0x55c5): the rotating spawn cursor at 0x8d14, taken mod
      // 16, indexes the kind table at 0x5627; the looked-up byte is the actor's kind/script id.
      const idx = mem8[SPAWN_SEQUENCE_INDEX_8D14] & KIND_INDEX_MASK;
      const [kindByte] = fetchByteFromTableIndex(m, SPAWN_KIND_TABLE_5627, idx);
      // Stamp the kind byte into the record's (ix+0x17) field, where the initializer reads it
      // (0x55c8).
      mem8[u16(cursor + KIND_FIELD)] = kindByte;
      // Hand the free record to the shared actor initializer (0x5489) with the spawn-type field
      // value 0x13. The initializer stamps the record live and seeds its coordinates, facing,
      // animation, and speed, then returns in a way that ends this whole spawner pass — so
      // exactly one actor is seeded per call and the scan does not resume.
      if (!loc_5489(m, cursor, SPAWN_FIELD_VALUE)) return; // initializer completes the record and ends the pass
    }
    // Occupied (or just-completed) slot: advance to the next record and keep scanning (0x55cf).
    cursor = u16(cursor + stride);
  }
  // No free slot anywhere in the pool (0x55d3): nothing is spawned this call.
}
