// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_31b1 — one pass over the five records of the 0x6400 object array, running the
 * per-object state machine on each occupied record.  ROM 0x31B1.
 *
 * Three parts:
 *
 *   1. armAlternateFireModeAtHighDifficulty runs first — the difficulty+entropy gated arm that stamps a field on
 *      records 1 and 3 of this same array.
 *   2. The sweep index is zeroed and OBJ_ITER_PTR is seeded one stride BELOW the array
 *      base. The pointer is advanced BEFORE each record is read, so the first record
 *      visited is OBJ_ARRAY_64 itself and the seeded value is never read.
 *   3. Five iterations: advance the pointer one stride and store it back, then, when
 *      that record's occupancy flag (field +0) is non-zero, run the per-object state
 *      machine at ROM 0x3202. An empty record is skipped but still consumes an
 *      iteration, so the five iterations map one-to-one onto the five records.
 *
 * THE POINTER LIVES IN MEMORY, AND THAT IS LOAD-BEARING: OBJ_ITER_PTR is how the record
 * base reaches ROM 0x3202, whose first act is to load its record pointer out of that
 * cell (it reloads from it twice more, because its own callees clobber the register).
 * Keeping the pointer only in a local would leave the cell stale and 0x3202 would work
 * the wrong record. The sweep index is likewise re-read from memory each iteration, so
 * a callee that rewrote either cell would steer the rest of the sweep — faithful to the
 * oracle, which reloads both.
 *
 * Reads and writes OBJ_ITER_PTR and the sweep index; reads field +0 of each record it
 * visits. Everything else it touches, it touches through its two callees.
 *
 * NAME: kept the neutral loc_ — the iteration is pinned to the oracle, but what the
 * swept objects ARE, and what 0x3202 does with them, is not established here.
 *
 * Memory-equivalent to the frozen oracle — equivalence-31b1.test.js.
 * GATE:     captured + crafted + live. 481 real dispatches were captured from a
 *           3000-frame attract run, of which 25 were replayed (every 20th plus the first
 *           at each entry shape); attract presents ONE entry shape — record 0 occupied,
 *           records 1-4 empty — so the captures cover a single occupancy pattern and say
 *           nothing about the other 31. Those, and a callee that rewrites the pointer and
 *           the index mid-sweep, are crafted on a real attract base with 0x3202 replaced
 *           by a marking stub. The rewrite is then wired live at 0x31B1 for a 3000-frame
 *           attract run, byte-identical per frame against the all-oracle baseline. All of
 *           it is ATTRACT; gameplay is not covered. Teeth: a pointer kept in a local
 *           instead of stored back, a post-increment pointer, a sweep index kept in a
 *           local instead of re-read, and a skipped 0x3202 call.
 * LIVE-OUT: memory-only, plus the guest stack left balanced. No return value (the
 *           oracle's `ret` carries none, and its one caller tests nothing). The registers
 *           the oracle defines and this rewrite drops are A, F, B, C, H and L. DERIVED:
 *           the sole caller — ROM 0x30ED, whose `call 0x31B1` at 0x30F3 is the only one
 *           in the translated layer — goes straight on to `call 0x34F3` (publishFireSprites), which
 *           loads its own source/destination pointers and record count and re-sets the
 *           flags before it reads anything, so A/F/B/H/L are dead within one instruction
 *           of the return; C survives that callee, and was followed out through the next
 *           two call levels (ROM 0x2E04's prologue and the two rst targets it enters)
 *           without being read. MEASURED: the gate's LIVE-OUT case scrambles all six
 *           after every oracle dispatch and a 3000-frame attract run stays byte-identical.
 * NAMES:    OBJ_ITER_PTR (0x63C8), OBJ_ARRAY_64 (0x6400), OBJ_ACTIVE (+0) from ram.js;
 *           armAlternateFireModeAtHighDifficulty direct-called. The sweep index at 0x63A2 has no ram.js name — it is
 *           referenced by no other routine in the translated layer — so it stays a local
 *           const. ROM 0x3202 is not in the ROUTINES registry, so it is still reached
 *           through m.call; the push beside it is the return address its frozen oracle's
 *           `ret` still consumes, and both dissolve into a direct call once 0x3202 is
 *           registered.
 */

import { u8, u16 } from "../../../core/int.js";
import { OBJ_ITER_PTR, OBJ_ARRAY_64, OBJ_ACTIVE } from "./ram.js";
import { armAlternateFireModeAtHighDifficulty } from "./armAlternateFireModeAtHighDifficulty.js"; // ROM 0x31DD — the difficulty+entropy gated object arm

// Loop counter cell: reset to 0, incremented once per record, compared against the
// record count. No ram.js name — nothing else in the translated layer references it.
const SWEEP_INDEX = 0x63a2;

const OBJECT_COUNT = 5;     // records swept from OBJ_ARRAY_64
const OBJECT_STRIDE = 32;   // bytes between object records

// The ROM address the still-frozen 0x3202 returns to. Its `ret` pops a return address
// off the guest stack, so the call site has to leave one there.
const AFTER_OBJECT_CALL = 0x31d0;

/**
 * @param {object} m  the machine (memory, plus the guest stack for the frozen 0x3202).
 * @returns {void}
 */
export function loc_31b1(m) {
  const { mem8, mem16 } = m;

  armAlternateFireModeAtHighDifficulty(m);

  mem8[SWEEP_INDEX] = 0;
  // One stride below the array base: the pointer is advanced before the first read, so
  // the first record visited is OBJ_ARRAY_64.
  mem16[OBJ_ITER_PTR] = OBJ_ARRAY_64 - OBJECT_STRIDE;

  for (;;) {
    // Advance to the next record and publish it — 0x3202 takes its record base from
    // this cell, not from an argument.
    const record = u16(mem16[OBJ_ITER_PTR] + OBJECT_STRIDE);
    mem16[OBJ_ITER_PTR] = record;

    if (mem8[record + OBJ_ACTIVE] !== 0) {
      m.push16(AFTER_OBJECT_CALL);
      m.call(0x3202); // per-object state machine — still the frozen oracle
    }

    // The index is re-read from memory, so a callee that moved it moves the sweep.
    const visited = u8(mem8[SWEEP_INDEX] + 1);
    mem8[SWEEP_INDEX] = visited;
    if (visited === OBJECT_COUNT) return;
  }
}
