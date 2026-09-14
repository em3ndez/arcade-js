// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  SAVED_INDEX2, ENEMY_SLOT_TOP, ENEMY_DEPTH, loc_29, loc_2a, TUBE_GEOM_FLAG, POKEY1_RANDOM,
  ENEMY_SEGMENT, ENEMY_PHASE, ENEMY_TIMER, COORD_LIST_PTR_LO, ENEMY_SLOT_DIR, COORD_LIST_PTR_HI, ENEMY_SCRIPT_CURSOR,
  ENEMY_TOTAL_COUNT, loc_2b, ENEMY_SLOT_FLAGS, LANE_ENEMY_COUNT_0,
} from "./names.js";

/**
 * spawnClimberInFreeSlot — seat a new climbing enemy in a free enemy slot. ROM 0x994d.
 *
 * Role in the machine: this is Tempest's climber allocator. The enemy tables are parallel
 * per-slot arrays (one entry per active enemy); spawning a climber means finding an empty entry
 * and filling every parallel array for that index with the new enemy's starting state — its depth
 * down the tube, the tube segment (lane) it occupies, its animation phase, its coordinate-list
 * pointer, and its flag byte. Callers (retireEnemyAndSpawnSplit for splits, spawnEnemyOnTimerExpiry
 * for timed spawns) stage the new enemy's fields in the loc_29..loc_2d scratch cells first, then
 * call here to commit them into an actual slot.
 *
 * Behavior: the incoming Y (a scratch/scan value) is parked in SAVED_INDEX2 (0x35). It scans the
 * slot index down from ENEMY_SLOT_TOP (loc_11c), skipping any slot whose depth cell ENEMY_DEPTH,y
 * (loc_2df) is nonzero (occupied). If the scan wraps past 0 (index goes negative), no slot is free
 * and it reports 0x00. On a free slot it seeds the parallel arrays: depth from loc_29; the target
 * segment from loc_2a, except that a segment of 0x0f on a closed/spoke tube (TUBE_GEOM_FLAG loc_111
 * bit7 set) is replaced by a random even lane (POKEY1_RANDOM & 0x0e) so spawns spread across the
 * rim; animation phase = (segment+1)&0x0f; timer cleared; the coordinate-list pointer split across
 * ENEMY_SLOT_DIR/ENEMY_SCRIPT_CURSOR from loc_2c/loc_2d; and the flag byte from loc_2b. It then
 * bumps the active-enemy total ENEMY_TOTAL_COUNT (loc_108) and the per-lane counter
 * LANE_ENEMY_COUNT_0+lane (loc_142), where lane is the low three bits of the flag byte. X is parked
 * back into SAVED_INDEX2, and it reports 0x10 (a hit).
 *
 * Live-out: the seeded slot across ENEMY_DEPTH/SEGMENT/PHASE/TIMER/SLOT_DIR/SCRIPT_CURSOR/SLOT_FLAGS,
 * the bumped ENEMY_TOTAL_COUNT and LANE_ENEMY_COUNT_0 counters, SAVED_INDEX2, and A = 0x10 hit /
 * 0x00 no-slot. Grounding: [seen].
 */
export function spawnClimberInFreeSlot(m, y = m.regs.y, x = m.regs.x) {
  const { mem8 } = m;
  mem8[SAVED_INDEX2] = y;                 // park caller's Y in scratch 0x35
  y = mem8[ENEMY_SLOT_TOP];               // scan from the top slot index down
  while (mem8[u16(ENEMY_DEPTH + y)] !== 0) {
    y = u8(y - 1);
    if (y & 0x80) return (m.regs.a = 0x00); // scanned past index 0 -> no free slot
  }
  mem8[u16(ENEMY_DEPTH + y)] = mem8[loc_29]; // depth from the staged request
  let a = mem8[loc_2a];
  // On a closed tube (loc_111 bit7), a staged segment of 0x0f is replaced by a random even lane.
  if (a === 0x0f && mem8[TUBE_GEOM_FLAG] & 0x80) a = mem8[POKEY1_RANDOM] & 0x0e;
  mem8[u16(ENEMY_SEGMENT + y)] = a;
  mem8[u16(ENEMY_PHASE + y)] = (a + 1) & 0x0f; // phase seeded one past the segment
  mem8[u16(ENEMY_TIMER + y)] = 0x00;
  mem8[u16(ENEMY_SLOT_DIR + y)] = mem8[COORD_LIST_PTR_LO];   // coord-list pointer low
  mem8[u16(ENEMY_SCRIPT_CURSOR + y)] = mem8[COORD_LIST_PTR_HI]; // coord-list pointer high
  mem8[ENEMY_TOTAL_COUNT] = mem8[ENEMY_TOTAL_COUNT] + 1;     // one more active enemy
  mem8[u16(ENEMY_SLOT_FLAGS + y)] = mem8[loc_2b];
  const lane = mem8[loc_2b] & 0x07;        // lane = low 3 bits of the flag byte
  mem8[SAVED_INDEX2] = x;                   // park X back into scratch
  mem8[u16(LANE_ENEMY_COUNT_0 + lane)] = mem8[u16(LANE_ENEMY_COUNT_0 + lane)] + 1; // per-lane tally
  return (m.regs.a = 0x10);                 // report a successful spawn
}
