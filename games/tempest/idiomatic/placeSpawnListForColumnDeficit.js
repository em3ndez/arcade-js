// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  ENEMY_SLOT_TOP, COLUMN_SPAWN_CAP, COLUMN_ENEMY_TARGET, OBJECT_ANIM_TIMER, SPAWN_DEFICIT_C0, SPAWN_DEFICIT_C2, SPAWN_DEFICIT_C3, LANE_ENEMY_COUNT_0,
  ENEMY_SLOT_DIR, ENEMY_DEPTH, loc_29, loc_2a, LANE_LIMIT, POKEY2_RANDOM, PROJ_Y_LO,
} from "./names.js";
import { dispatchListSetupByColumn } from "./dispatchListSetupByColumn.js";

/**
 * placeSpawnListForColumnDeficit — top up the per-column enemy quotas by placing a new spawn list. ROM
 * 0x99a5.
 *
 * Role in the machine: Tempest keeps a target population of enemies per spawn "column" of the tube. Each
 * wave-servicing pass this routine measures how far every column is below its target, subtracts what is
 * already in flight, and — if room remains — asks the list-setup dispatcher to seat a fresh spawn list on
 * the neediest column. It is the throttle that decides when and where the next batch of enemies enters.
 *
 * Behaviour, in four stages. (1) Build the five-column deficit table SPAWN_DEFICIT_C0[0..4] as
 * COLUMN_ENEMY_TARGET minus LANE_ENEMY_COUNT_0, keeping only nonnegative entries. (2) For every active
 * enemy slot (ENEMY_DEPTH set, low two bits of ENEMY_SLOT_DIR nonzero) deduct 2 from that lane's column,
 * with lane 3 remapping to column 5. (3) Compute a global cap = (ENEMY_SLOT_TOP + 1) minus the total of
 * LANE_ENEMY_COUNT_0[0..4] (byte-wrapping) and clamp every column down to it. (4) Count the nonzero
 * columns and branch: exactly one column scans for a column that has both a deficit and a COLUMN_SPAWN_CAP
 * entry; two-or-more scans below-cap columns, then — if columns 3 and 2 are both live — picks one via the
 * LANE_LIMIT threshold, then finally a round-robin sweep of all five columns seeded off POKEY2_RANDOM.
 *
 * Any dispatchListSetupByColumn that reports a placement returns immediately. Every exhausted path falls
 * through and clears the request flag loc_29 before returning.
 *
 * Live-out: SPAWN_DEFICIT_C0[0..4] (the deficit table), the decremented OBJECT_ANIM_TIMER column cells,
 * PROJ_Y_LO (the count-1 marker in the multi-column branch), whatever dispatchListSetupByColumn seats, and
 * loc_29 cleared on no placement. Grounding: [seen].
 */
export function placeSpawnListForColumnDeficit(m) {
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
      if (dispatchListSetupByColumn(m, x) !== 0) return;
    }
  } else if (count >= 2) {
    mem8[PROJ_Y_LO] = count - 1;
    // Place on the first column whose LANE_ENEMY_COUNT_0 entry is below its COLUMN_SPAWN_CAP entry.
    for (let x = 4; x >= 0; x--) {
      if (mem8[SPAWN_DEFICIT_C0 + x] === 0) continue;
      if (mem8[LANE_ENEMY_COUNT_0 + x] >= mem8[COLUMN_SPAWN_CAP + x]) continue;
      if (dispatchListSetupByColumn(m, x) !== 0) return;
    }
    // If columns 3 and 2 (SPAWN_DEFICIT_C3/SPAWN_DEFICIT_C2) are both active, pick a column from the LANE_LIMIT threshold.
    if (mem8[SPAWN_DEFICIT_C3] !== 0 && mem8[SPAWN_DEFICIT_C2] !== 0) {
      let val = mem8[u16(LANE_LIMIT + mem8[loc_2a])];
      if (val === 0) val = 0xff;
      const col = val >= 0xcc ? 3 : 2;
      if (dispatchListSetupByColumn(m, col) !== 0) return;
    }
    // Round-robin sweep of all five columns, starting just past the the POKEY random register low-two-bits index.
    let x = (mem8[POKEY2_RANDOM] & 0x03) + 1;
    for (let y = 4; y >= 0; y--) {
      if (mem8[COLUMN_SPAWN_CAP + x] !== 0 && mem8[SPAWN_DEFICIT_C0 + x] !== 0) {
        if (dispatchListSetupByColumn(m, x) !== 0) return;
      }
      x = x - 1;
      if (x < 0) x = 4;
    }
  }

  // No placement (or no active column): clear the request flag.
  mem8[loc_29] = 0;
}
