// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceLiveFires — walk the five records of the fire array once per frame and advance each live
 * one. This is the walker: it decides which records get a turn, not what happens to one.
 * A gated arm runs first (it stamps a field on two records of this array). Then the sweep index is
 * zeroed and OBJ_ITER_PTR is seeded one stride BELOW the array base, because the pointer is advanced
 * before each read — so the first record visited is OBJ_ARRAY_64 and the seeded value is never read.
 * Five iterations follow, one per record; an inactive record is skipped but still burns an iteration.
 * THE POINTER LIVES IN MEMORY, AND THAT IS LOAD-BEARING: OBJ_ITER_PTR is how the record base reaches
 * the per-object advance, which reloads its pointer from that cell. The sweep index is likewise
 * re-read each iteration, so a callee that rewrote either cell would steer the rest of the sweep.
 */

import { u8, u16 } from "../../../core/int.js";
import { OBJ_ITER_PTR, OBJ_ARRAY_64, OBJ_ACTIVE } from "./names.js";
import { armAlternateFireModeAtHighDifficulty } from "./armAlternateFireModeAtHighDifficulty.js";

const SWEEP_INDEX = 0x63a2; // loop counter cell; carries no registered name
const FIRE_COUNT = 5;
const FIRE_STRIDE = 32;
// The per-object advance pops a return address off the guest stack, so leave one at the call site.
const AFTER_ADVANCE = 0x31d0;

export function advanceLiveFires(m) {
  const { mem8, mem16 } = m;

  armAlternateFireModeAtHighDifficulty(m);

  mem8[SWEEP_INDEX] = 0;
  mem16[OBJ_ITER_PTR] = OBJ_ARRAY_64 - FIRE_STRIDE;

  for (;;) {
    // Advance to the next record and publish it; the advance reads its base from this cell.
    const record = u16(mem16[OBJ_ITER_PTR] + FIRE_STRIDE);
    mem16[OBJ_ITER_PTR] = record;

    if (mem8[record + OBJ_ACTIVE] !== 0) {
      m.push16(AFTER_ADVANCE);
      m.call(0x3202);
    }

    const visited = u8(mem8[SWEEP_INDEX] + 1);
    mem8[SWEEP_INDEX] = visited;
    if (visited === FIRE_COUNT) return;
  }
}
