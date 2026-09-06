// SPDX-License-Identifier: GPL-3.0-only
// Consume the one-shot refill trigger and, while the region-clear gate is open, launch a new attacker:
// derive a slot budget from the pace counter, claim the first empty object slot, pick an occupancy
// column by direction, then walk that grid column for a filled cell — clear it, seed the object struct,
// and enqueue its spawn command.
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import { u16 } from "../../../core/int.js";
import {
  SUBCOUNTER_REFILL_FLAG,
  loc_4220,
  loc_421a,
  loc_421b,
  loc_4391,
  loc_4215,
  COLUMN_OCCUPANCY,
  loc_41ef,
  FLAG_BITS_BASE,
} from "./names.js";

const SLOT_STRIDE = 31;      // object-slot table pitch, scanned downward
const COLUMN_COUNT = 10;     // occupancy columns in the summary row
const OCCUPIED = 1;          // column/grid-cell marker
const ROW_STEP = 16;         // one grid row (page-low stride)

export function loc_1344(m) {
  const { mem8 } = m;

  // One-shot: only run when the refill trigger is raised, then consume it.
  if (!(mem8[SUBCOUNTER_REFILL_FLAG] & 1)) return;
  mem8[SUBCOUNTER_REFILL_FLAG] = 0;

  // Hold off while the region-clear gate is set.
  if (mem8[loc_4220] & 1) return;

  // Slot budget from the pace counter: ((hi+lo) folded right) capped at 3, then +1 -> 1..4.
  const sum = mem8[loc_421a] + mem8[loc_421b];
  const folded = ((sum > 0xff ? 0x80 : 0) | ((sum & 0xff) >> 1)) & 0xff;
  const budget = Math.min(folded, 3) + 1;

  // Claim the first empty (both-bytes-zero) slot, scanning downward.
  let slot = -1;
  for (let top = loc_4391, i = 0; i < budget; i++) {
    const lower = u16(top - 1);
    if ((mem8[top] | mem8[lower]) === 0) { slot = lower; break; }
    top = u16(lower - SLOT_STRIDE);
  }
  if (slot < 0) return;

  // Stamp the launch direction into the slot; it also selects the column-scan orientation.
  const direction = mem8[loc_4215];
  mem8[slot + 6] = direction;

  // Find an occupied column: direction 0 scans the row from the high end down, else from the low end up.
  let col, step;
  if (direction === 0) {
    col = scanColumns(mem8, COLUMN_OCCUPANCY + 12, -1);
    step = 63;
  } else {
    col = scanColumns(mem8, COLUMN_OCCUPANCY + 3, 1);
    step = 65;
  }
  if (col < 0) return;
  const remaining = COLUMN_COUNT - 1 - col; // columns left to try, mirroring the search's leftover count

  // Landing column low byte, and the grid geometry chosen by the sweep-mode flag.
  const colLow = (direction === 0 ? COLUMN_OCCUPANCY + 12 - col : COLUMN_OCCUPANCY + 3 + col) & 0x0f;
  let rows, low, columnStep;
  if (mem8[loc_41ef] & 1) {
    rows = 4; low = colLow + 80; columnStep = step;
  } else {
    rows = 5; low = colLow + 96; columnStep = (step + ROW_STEP) & 0xff;
  }

  // Walk columns; within each, climb `rows` grid cells looking for a filled one.
  for (let left = remaining; ; ) {
    let hit = -1;
    for (let r = rows; ; ) {
      const cell = FLAG_BITS_BASE + low;
      if (mem8[cell] & 1) { hit = cell; break; }
      low = (low - ROW_STEP) & 0xff;
      if (--r === 0) break;
    }
    if (hit >= 0) {
      // Consume the formation cell, activate the object at state 0, and enqueue its spawn.
      mem8[hit] = 0;
      mem8[slot + 7] = low;
      mem8[slot] = OCCUPIED;
      mem8[slot + 2] = 0;
      enqueueCommandWord(m, (1 << 8) | low, hit);
      return;
    }
    low = (low + columnStep) & 0xff;
    if (--left === 0) return;
  }
}

// First column (by scan index) that is marked occupied, but never the final cell of the row
// (a last-cell match exhausts the counter and aborts). Returns the scan index, or -1.
function scanColumns(mem8, start, dir) {
  for (let i = 0; i < COLUMN_COUNT; i++) {
    if (mem8[start + i * dir] === OCCUPIED) return i < COLUMN_COUNT - 1 ? i : -1;
  }
  return -1;
}
