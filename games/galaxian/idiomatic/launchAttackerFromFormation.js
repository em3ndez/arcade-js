// SPDX-License-Identifier: GPL-3.0-only

/**
 * launchAttackerFromFormation — peel one diving attacker out of the standing formation.
 *
 * WHAT IT IS
 *   The spawner half of the enemy pacing loop. paceEnemyLaunchTrigger (0x1515) is a difficulty-scaled
 *   prescaler that, when an attacker sub-counter expires, raises the one-shot flag SUBCOUNTER_REFILL_FLAG
 *   (0x4228). This routine fires exactly once each time that flag is up: it claims a free object slot,
 *   picks a live alien out of the formation bitmap, removes it from the standing block, and hands it to
 *   the object-AI as a brand-new diving attacker (which initSpawnedObjectFromGridCell then seeds).
 *
 * ROLE IN THE MACHINE
 *   Runs every frame but does nothing unless the refill flag is set (and consumed) and the region-clear
 *   gate (loc_4220 bit0) is clear. The launch direction comes from loc_4215 (set by
 *   chooseNextAttackerDirection) and steers both which end of the occupancy row is scanned and the grid
 *   geometry walked. On success it clears the chosen formation cell in FLAG_BITS_BASE (0x4100), activates
 *   the object slot (byte0=1 active, byte2=0 AI sub-state, slot+6=direction, slot+7=grid cell), and posts
 *   a type-1 spawn command word. Reads the pace counter (loc_421a + loc_421b) for its slot budget.
 *
 * ROM 0x1344.  Grounding: [seen].
 */
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

export function launchAttackerFromFormation(m) {
  const { mem8 } = m;

  // One-shot: only run when the refill trigger is raised, then consume it.
  if (!(mem8[SUBCOUNTER_REFILL_FLAG] & 1)) return;
  mem8[SUBCOUNTER_REFILL_FLAG] = 0;

  // Hold off while the region-clear gate is set (e.g. a wave is being cleared/rebuilt).
  if (mem8[loc_4220] & 1) return;

  // Slot budget from the pace counter: ((hi+lo) folded right) capped at 3, then +1 -> 1..4. This limits
  // how deep the slot scan probes, so a busier field (higher counter) is allowed to look at more slots.
  const sum = mem8[loc_421a] + mem8[loc_421b];
  const folded = ((sum > 0xff ? 0x80 : 0) | ((sum & 0xff) >> 1)) & 0xff;
  const budget = Math.min(folded, 3) + 1;

  // Claim the first empty (both-bytes-zero) slot, scanning downward from the top of the object-slot table
  // in SLOT_STRIDE steps. The slot address is the `lower` byte of each candidate pair.
  let slot = -1;
  for (let top = loc_4391, i = 0; i < budget; i++) {
    const lower = u16(top - 1);
    if ((mem8[top] | mem8[lower]) === 0) { slot = lower; break; }
    top = u16(lower - SLOT_STRIDE);
  }
  // No free slot within the budget -- nothing launches this frame.
  if (slot < 0) return;

  // Stamp the launch direction into the slot; it also selects the column-scan orientation.
  const direction = mem8[loc_4215];
  mem8[slot + 6] = direction;

  // Find an occupied column: direction 0 scans the row from the high end down, else from the low end up.
  // scanColumns returns the first occupied column's scan index (never the row's last cell).
  let col, step;
  if (direction === 0) {
    col = scanColumns(mem8, COLUMN_OCCUPANCY + 12, -1);
    step = 63;
  } else {
    col = scanColumns(mem8, COLUMN_OCCUPANCY + 3, 1);
    step = 65;
  }
  // Formation has no eligible column -- abort.
  if (col < 0) return;
  const remaining = COLUMN_COUNT - 1 - col; // columns left to try, mirroring the search's leftover count

  // Landing column low byte, and the grid geometry chosen by the sweep-mode flag. loc_41ef bit0 picks a
  // 4-row (compressed) vs 5-row (full) formation block and the starting page-low offset / column stride.
  const colLow = (direction === 0 ? COLUMN_OCCUPANCY + 12 - col : COLUMN_OCCUPANCY + 3 + col) & 0x0f;
  let rows, low, columnStep;
  if (mem8[loc_41ef] & 1) {
    rows = 4; low = colLow + 80; columnStep = step;
  } else {
    rows = 5; low = colLow + 96; columnStep = (step + ROW_STEP) & 0xff;
  }

  // Walk columns; within each, climb `rows` grid cells (upward, one ROW_STEP per row) looking for a
  // filled formation cell in the FLAG_BITS_BASE bitmap.
  for (let left = remaining; ; ) {
    let hit = -1;
    for (let r = rows; ; ) {
      const cell = FLAG_BITS_BASE + low;
      // A live alien in this grid cell -> take it as the one to launch.
      if (mem8[cell] & 1) { hit = cell; break; }
      low = (low - ROW_STEP) & 0xff;
      if (--r === 0) break;
    }
    if (hit >= 0) {
      // Consume the formation cell (mem8[hit]=0 removes it from the standing block), then activate the
      // object slot: slot+7 = its grid cell, slot byte0 = active marker, slot byte2 = AI sub-state 0 (so
      // initSpawnedObjectFromGridCell runs on its next tick). Finally enqueue the type-1 spawn command
      // word. The alien is now a diving attacker rather than part of the standing block.
      mem8[hit] = 0;
      mem8[slot + 7] = low;
      mem8[slot] = OCCUPIED;
      mem8[slot + 2] = 0;
      enqueueCommandWord(m, (1 << 8) | low, hit);
      return;
    }
    // Nothing filled in this column: step to the next column and try again until the budget runs out.
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
