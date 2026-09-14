// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  loc_9f, loc_2b, COORD_LIST_PTR_LO, COORD_LIST_PTR_HI, SLOT_LOOP_INDEX, TABLE_CURSOR, WORK_PTR_LO, WORK_PTR_HI,
  HIT_DISTANCE_THRESHOLD, loc_b3, COORD_DISPATCH_SEL, INITIAL_ACTIVE_COUNT, DSW_DIFFICULTY, LIST_SELECT_FLAGS, FLYER_SLOT_TOP, OBJECT_VELOCITY_HI, OBJECT_VELOCITY_LO,
  CANDIDATE_LANE_0, CANDIDATE_LANE_1, ENEMY_BAND_THRESHOLD_0, ENEMY_BAND_THRESHOLD_1, ENEMY_BAND_THRESHOLD_2, ENEMY_BAND_THRESHOLD_3, ENEMY_BAND_THRESHOLD_4, ENEMY_CLIMB_DELTA_LO_0, ENEMY_CLIMB_DELTA_LO_1,
  ENEMY_CLIMB_DELTA_LO_2, ENEMY_CLIMB_DELTA_LO_3, ENEMY_CLIMB_DELTA_LO_4, ENEMY_CLIMB_DELTA_HI_0, ENEMY_CLIMB_DELTA_HI_1, ENEMY_CLIMB_DELTA_HI_2, ENEMY_CLIMB_DELTA_HI_3, ENEMY_CLIMB_DELTA_HI_4,
  POKEY2_RANDOM, STATE_RESEED_RECORD_TABLE,
} from "./names.js";
import { dispatchRangeValueBySelector } from "./dispatchRangeValueBySelector.js";
import { dispatchCursorAdvanceBySelector } from "./dispatchCursorAdvanceBySelector.js";
import { partitionByteToFineCoarseSeed } from "./partitionByteToFineCoarseSeed.js";

// State re-seed. Builds the search key loc_2b (loc_9f, or a fresh masked value when loc_9f is too large),
// then walks a 4-byte-record table for record index 111 down to 3 (step -4): each record
// gives a source list pointer (COORD_LIST_PTR_LO/COORD_LIST_PTR_HI) and a destination pointer (WORK_PTR_LO/WORK_PTR_HI). For each record it
// scans the source list for the range that brackets the key, storing the range's resolved byte (0 if the
// list runs out) through the destination pointer. Finally it rescales ENEMY_CLIMB_DELTA_LO_0/INITIAL_ACTIVE_COUNT per DSW_DIFFICULTY & 3 and
// re-scales three cells (ENEMY_CLIMB_DELTA_LO_3, OBJECT_VELOCITY_LO, ENEMY_CLIMB_DELTA_LO_0) through the folding helper, seeding many loc_01xx cells.
export function reseedStateTables(m) {
  const { mem8, mem16 } = m;

  // search key: loc_9f, unless >= 98 -> a fresh value from (the POKEY random register & 0x1f) | 0x40; then +1
  let key = mem8[loc_9f];
  if (key >= 98) key = (mem8[POKEY2_RANDOM] & 0x1f) | 0x40;
  mem8[loc_2b] = key;
  mem8[loc_2b] = mem8[loc_2b] + 1;

  // record index 111 -> 3, step -4 (stop when it underflows past 3 to 255)
  mem8[SLOT_LOOP_INDEX] = 111;
  while (true) {
    const index = mem8[SLOT_LOOP_INDEX];
    mem8[WORK_PTR_HI] = mem8[u16(STATE_RESEED_RECORD_TABLE + index + 3)];
    mem8[WORK_PTR_LO] = mem8[u16(STATE_RESEED_RECORD_TABLE + index + 2)];
    mem8[COORD_LIST_PTR_HI] = mem8[u16(STATE_RESEED_RECORD_TABLE + index + 1)];
    mem8[COORD_LIST_PTR_LO] = mem8[u16(STATE_RESEED_RECORD_TABLE + index)];
    mem8[TABLE_CURSOR] = 1;

    // scan the source list for the [lo, hi] range that brackets the search key
    let resolved = 0;
    let y = 0;
    while (true) {
      const listPtr = mem16[COORD_LIST_PTR_LO];
      const entry = mem8[u16(listPtr + y)];
      mem8[COORD_DISPATCH_SEL] = entry;
      if (entry === 0) { resolved = 0; break; } // list exhausted
      const k = mem8[loc_2b];
      y = u8(y + 1);
      const lo = mem8[u16(listPtr + y)];
      y = u8(y + 1);
      let advance = k < lo;
      if (!advance) {
        const hi = mem8[u16(listPtr + y)];
        advance = k > hi;
        if (!advance) {                     // lo <= key <= hi -> range hit
          y = u8(y + 1);
          const r = dispatchRangeValueBySelector(m, y);         // yields the byte to store (first element if it also returns an index)
          resolved = Array.isArray(r) ? r[0] : r;
          break;
        }
      }
      const [, yy] = dispatchCursorAdvanceBySelector(m, y);        // the step helper advances the cursor; continue from it
      y = yy;
    }

    mem8[u16(mem16[WORK_PTR_LO])] = resolved;    // store through the destination pointer

    mem8[SLOT_LOOP_INDEX] = u8(index - 4);
    if (mem8[SLOT_LOOP_INDEX] === 255) break;
  }

  // rescale on DSW_DIFFICULTY & 3: 1 -> down, 2 -> up, else none
  const mode = mem8[DSW_DIFFICULTY] & 0x03;
  if (mode === 1) {
    mem8[FLYER_SLOT_TOP] = u8(mem8[FLYER_SLOT_TOP] - 1);
    const v = mem8[ENEMY_CLIMB_DELTA_LO_0];
    const inv = v ^ 0xff;
    mem8[ENEMY_CLIMB_DELTA_LO_0] = (inv >> 3) + v + ((inv >> 2) & 1);
    if (mem8[loc_9f] < 17) mem8[loc_b3] = u8(mem8[loc_b3] - 1);
  } else if (mode === 2) {
    const bumped = u8(mem8[FLYER_SLOT_TOP] + 1);
    mem8[FLYER_SLOT_TOP] = bumped >= 3 ? 3 : bumped;
    const v = mem8[ENEMY_CLIMB_DELTA_LO_0];
    mem8[ENEMY_CLIMB_DELTA_LO_0] = ((v >> 3) | 0xe0) + v + ((v >> 2) & 1);
    const w = mem8[INITIAL_ACTIVE_COUNT];
    mem8[INITIAL_ACTIVE_COUNT] = (w >> 3) + w + ((w >> 2) & 1);
    mem8[LIST_SELECT_FLAGS] = mem8[LIST_SELECT_FLAGS] | 0x40;
  }

  // fold three cells through the helper (returns [A, X, Y]) and fan the results out
  const [a163, x163, y163] = partitionByteToFineCoarseSeed(m, mem8[ENEMY_CLIMB_DELTA_LO_3]);
  mem8[ENEMY_CLIMB_DELTA_LO_3] = a163;
  mem8[ENEMY_CLIMB_DELTA_HI_3] = y163;
  mem8[ENEMY_BAND_THRESHOLD_3] = x163;

  const [a120, x120, y120] = partitionByteToFineCoarseSeed(m, mem8[OBJECT_VELOCITY_LO]);
  mem8[OBJECT_VELOCITY_LO] = a120;
  mem8[OBJECT_VELOCITY_HI] = y120;
  mem8[HIT_DISTANCE_THRESHOLD] = x120;

  const [a160, x160, y160] = partitionByteToFineCoarseSeed(m, mem8[ENEMY_CLIMB_DELTA_LO_0]);
  mem8[ENEMY_CLIMB_DELTA_LO_0] = a160;
  mem8[ENEMY_CLIMB_DELTA_LO_2] = a160;
  mem8[ENEMY_CLIMB_DELTA_HI_2] = y160;
  mem8[ENEMY_CLIMB_DELTA_HI_0] = y160;
  mem8[ENEMY_BAND_THRESHOLD_0] = x160;
  mem8[ENEMY_BAND_THRESHOLD_2] = x160;
  mem8[ENEMY_BAND_THRESHOLD_1] = x160;

  mem8[ENEMY_CLIMB_DELTA_LO_4] = mem8[ENEMY_CLIMB_DELTA_LO_0] << 1;               // shift left, carry out is bit 7
  mem8[ENEMY_CLIMB_DELTA_HI_4] = (mem8[ENEMY_CLIMB_DELTA_HI_0] << 1) | (mem8[ENEMY_CLIMB_DELTA_LO_0] >> 7);

  mem8[ENEMY_BAND_THRESHOLD_4] = 6;
  mem8[ENEMY_CLIMB_DELTA_LO_1] = 160;
  mem8[ENEMY_CLIMB_DELTA_HI_1] = 254;
  mem8[CANDIDATE_LANE_1] = 1;
  mem8[CANDIDATE_LANE_0] = 1;
}
