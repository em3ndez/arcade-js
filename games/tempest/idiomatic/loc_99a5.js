// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  ENEMY_SLOT_TOP, COLUMN_SPAWN_CAP, COLUMN_ENEMY_TARGET, OBJECT_ANIM_TIMER, SPAWN_DEFICIT_C0, SPAWN_DEFICIT_C2, SPAWN_DEFICIT_C3, LANE_ENEMY_COUNT_0,
  ENEMY_SLOT_DIR, ENEMY_DEPTH, loc_29, loc_2a, LANE_LIMIT, POKEY2_RANDOM, PROJ_Y_LO,
} from "./names.js";
import { loc_9a87 } from "./loc_9a87.js";

// Builds the five-column deficit table SPAWN_DEFICIT_C0[0..4] from COLUMN_ENEMY_TARGET minus LANE_ENEMY_COUNT_0 (clamped nonnegative),
// deducts per active lane, and caps every column at (ENEMY_SLOT_TOP + 1) minus the LANE_ENEMY_COUNT_0 total. Then, by how
// many columns remain nonzero, tries the list-setup dispatcher to place a list: on one column it scans SPAWN_DEFICIT_C0/COLUMN_SPAWN_CAP;
// on two or more it scans a wider set including a LANE_LIMIT-selected extra and a round-robin sweep. Any
// successful placement returns immediately; every exhausted path clears loc_29 before returning.
export function loc_99a5(m) {
  const { mem8 } = m;

  // Clear the deficit table, then seed each column with COLUMN_ENEMY_TARGET - LANE_ENEMY_COUNT_0 where that is nonnegative.
  for (let x = 4; x >= 0; x--) mem8[SPAWN_DEFICIT_C0 + x] = 0;
  for (let x = 4; x >= 0; x--) {
    const deficit = mem8[COLUMN_ENEMY_TARGET + x] - mem8[LANE_ENEMY_COUNT_0 + x];
    if (deficit >= 0) mem8[SPAWN_DEFICIT_C0 + x] = deficit;
  }

  // For each active lane (ENEMY_DEPTH set and ENEMY_SLOT_DIR low two bits nonzero), deduct 2 from that column
  // (lane 3 remaps to column 5).
  for (let y = mem8[ENEMY_SLOT_TOP]; y >= 0; y--) {
    if (mem8[u16(ENEMY_DEPTH + y)] === 0) continue;
    const lane = mem8[u16(ENEMY_SLOT_DIR + y)] & 0x03;
    if (lane === 0) continue;
    const col = lane === 3 ? 5 : lane;
    mem8[OBJECT_ANIM_TIMER + col] = mem8[OBJECT_ANIM_TIMER + col] - 1;
    mem8[OBJECT_ANIM_TIMER + col] = mem8[OBJECT_ANIM_TIMER + col] - 1;
  }

  // Cap = (ENEMY_SLOT_TOP + 1) - total of LANE_ENEMY_COUNT_0[0..4], wrapping as a byte; clamp every column down to it.
  let cap = u8(mem8[ENEMY_SLOT_TOP] + 1);
  for (let x = 4; x >= 0; x--) cap = u8(cap - mem8[LANE_ENEMY_COUNT_0 + x]);
  for (let x = 4; x >= 0; x--) {
    if (cap < mem8[SPAWN_DEFICIT_C0 + x]) mem8[SPAWN_DEFICIT_C0 + x] = cap;
  }

  // Count the nonzero columns.
  let count = 0;
  for (let x = 4; x >= 0; x--) if (mem8[SPAWN_DEFICIT_C0 + x] !== 0) count++;

  if (count === 1) {
    // One column active: place on the first column that has both a deficit and a COLUMN_SPAWN_CAP entry.
    for (let x = 4; x >= 0; x--) {
      if (mem8[SPAWN_DEFICIT_C0 + x] === 0) continue;
      if (mem8[COLUMN_SPAWN_CAP + x] === 0) continue;
      if (loc_9a87(m, x) !== 0) return;
    }
  } else if (count >= 2) {
    mem8[PROJ_Y_LO] = count - 1;
    // Place on the first column whose LANE_ENEMY_COUNT_0 entry is below its COLUMN_SPAWN_CAP entry.
    for (let x = 4; x >= 0; x--) {
      if (mem8[SPAWN_DEFICIT_C0 + x] === 0) continue;
      if (mem8[LANE_ENEMY_COUNT_0 + x] >= mem8[COLUMN_SPAWN_CAP + x]) continue;
      if (loc_9a87(m, x) !== 0) return;
    }
    // If columns 3 and 2 (SPAWN_DEFICIT_C3/SPAWN_DEFICIT_C2) are both active, pick a column from the LANE_LIMIT threshold.
    if (mem8[SPAWN_DEFICIT_C3] !== 0 && mem8[SPAWN_DEFICIT_C2] !== 0) {
      let val = mem8[u16(LANE_LIMIT + mem8[loc_2a])];
      if (val === 0) val = 0xff;
      const col = val >= 0xcc ? 3 : 2;
      if (loc_9a87(m, col) !== 0) return;
    }
    // Round-robin sweep of all five columns, starting just past the the POKEY random register low-two-bits index.
    let x = (mem8[POKEY2_RANDOM] & 0x03) + 1;
    for (let y = 4; y >= 0; y--) {
      if (mem8[COLUMN_SPAWN_CAP + x] !== 0 && mem8[SPAWN_DEFICIT_C0 + x] !== 0) {
        if (loc_9a87(m, x) !== 0) return;
      }
      x = x - 1;
      if (x < 0) x = 4;
    }
  }

  // No placement (or no active column): clear the request flag.
  mem8[loc_29] = 0;
}
