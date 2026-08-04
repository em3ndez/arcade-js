// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceLiveFires — walk the five records of the fire array once per frame and advance each live
 * one.
 *
 * This is the WALKER between the per-frame fire service above it and the per-object advance below
 * it; it decides which records get a turn, and nothing about what happens to one.
 *
 * Three parts:
 *
 *   1. The difficulty-and-entropy gated arm runs first — it stamps a field on two records of this
 *      same array.
 *   2. The sweep index is zeroed and OBJ_ITER_PTR is seeded one stride BELOW the array base. The
 *      pointer is advanced BEFORE each record is read, so the first record visited is
 *      OBJ_ARRAY_64 itself and the seeded value is never read.
 *   3. Five iterations: advance the pointer one stride and store it back, then, when that record's
 *      OBJ_ACTIVE flag is non-zero, run the per-object advance. An empty record is skipped but
 *      still consumes an iteration, so the five iterations map one-to-one onto the five records.
 *
 * THE POINTER LIVES IN MEMORY, AND THAT IS LOAD-BEARING: OBJ_ITER_PTR is how the record base
 * reaches the per-object advance, whose first act is to load its record pointer out of that cell
 * (it reloads from it twice more, because its own callees clobber the register). Keeping the
 * pointer only in a local would leave the cell stale and the advance would work the wrong record.
 * The sweep index is likewise re-read from memory each iteration, so a callee that rewrote either
 * cell would steer the rest of the sweep.
 *
 * Reads and writes OBJ_ITER_PTR and the sweep index; reads OBJ_ACTIVE of each record it visits.
 * Everything else it touches, it touches through its two callees.
 *
 * LIVE-OUT: memory only, plus the guest stack left balanced. No return value.
 */

import { u8, u16 } from "../../../core/int.js";
import { OBJ_ITER_PTR, OBJ_ARRAY_64, OBJ_ACTIVE } from "./names.js";
import { armAlternateFireModeAtHighDifficulty } from "./armAlternateFireModeAtHighDifficulty.js";

// Loop counter cell: reset to 0, incremented once per record, compared against the record count.
// It carries no registered name — nothing outside this walk reads it.
const SWEEP_INDEX = 0x63a2;

const FIRE_COUNT = 5;      // records swept from OBJ_ARRAY_64
const FIRE_STRIDE = 32;    // bytes between fire records

// Where the per-object advance returns to. It pops a return address off the guest stack, so this
// call site has to leave one there.
const AFTER_ADVANCE = 0x31d0;

/**
 * @param {object} m  the machine (memory, plus the guest stack the per-object advance returns on).
 * @returns {void}
 */
export function advanceLiveFires(m) {
  const { mem8, mem16 } = m;

  armAlternateFireModeAtHighDifficulty(m);

  mem8[SWEEP_INDEX] = 0;
  // One stride below the array base: the pointer is advanced before the first read, so
  // the first record visited is OBJ_ARRAY_64.
  mem16[OBJ_ITER_PTR] = OBJ_ARRAY_64 - FIRE_STRIDE;

  for (;;) {
    // Advance to the next record and publish it — the per-object advance takes its record base
    // from this cell, not from an argument.
    const record = u16(mem16[OBJ_ITER_PTR] + FIRE_STRIDE);
    mem16[OBJ_ITER_PTR] = record;

    if (mem8[record + OBJ_ACTIVE] !== 0) {
      m.push16(AFTER_ADVANCE);
      m.call(0x3202); // advance this one fire
    }

    // The index is re-read from memory, so a callee that moved it moves the sweep.
    const visited = u8(mem8[SWEEP_INDEX] + 1);
    mem8[SWEEP_INDEX] = visited;
    if (visited === FIRE_COUNT) return;
  }
}
