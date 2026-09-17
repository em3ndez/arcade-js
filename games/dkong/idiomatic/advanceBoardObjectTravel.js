// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceBoardObjectTravel — advance the six board objects: each active object (OBJ_ACTIVE bit0)
 * drifts one pixel vertically per pass. OBJ_STATE bit3 picks direction (larger Y is lower):
 * rising decreases Y and, on reaching the top row (96), LANDS — X snaps to a fixed column and
 * OBJ_STATE becomes 4 (bit3 clear, so the next pass falls); falling increases Y and, on reaching
 * the bottom (248), DEACTIVATES.
 *
 * The record stride (16) is RETURNED, and the return is load-bearing: the spawn walk that runs
 * immediately after reuses it without reloading.
 *
 * LIVE-OUT: the six records' OBJ_Y / OBJ_ACTIVE / OBJ_X / OBJ_STATE in memory, plus the record
 * stride returned for the spawn walk.
 */

import { OBJ_ARRAY_66, OBJ_ACTIVE, OBJ_STATE, OBJ_X, OBJ_Y } from "./names.js";

const STRIDE = 0x10;
const RECORD_COUNT = 6;
const STATE_RISING = 0x08;    // OBJ_STATE bit3: set => rising
const RISE_LAND_Y = 96;
const FALL_GONE_Y = 248;
const LANDED_X = 119;
const LANDED_STATE = 0x04;    // bit3 clear => the next pass falls

/**
 * @returns {number} the object-record stride, which the spawn walk reuses as its own.
 */
export function advanceBoardObjectTravel(m) {
  const { mem8 } = m;

  for (let i = 0; i < RECORD_COUNT; i++) {
    const obj = OBJ_ARRAY_66 + i * STRIDE;

    if ((mem8[obj + OBJ_ACTIVE] & 0x01) === 0) continue;

    if ((mem8[obj + OBJ_STATE] & STATE_RISING) !== 0) {
      const y = mem8[obj + OBJ_Y] - 1;
      mem8[obj + OBJ_Y] = y;
      if (y === RISE_LAND_Y) {
        mem8[obj + OBJ_X] = LANDED_X;
        mem8[obj + OBJ_STATE] = LANDED_STATE;
      }
    } else {
      const y = mem8[obj + OBJ_Y] + 1;
      mem8[obj + OBJ_Y] = y;
      if (y === FALL_GONE_Y) mem8[obj + OBJ_ACTIVE] = 0x00;
    }
  }

  return STRIDE;
}
