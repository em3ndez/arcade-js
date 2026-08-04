// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceBoardObjectTravel — advance the six board objects: each active object drifts one
 * pixel vertically toward its limit, then lands or deactivates on arrival.
 *
 * The array holds six 16-byte object records. This runs once per board-object service pass
 * and walks all six. A record is processed only while its active flag (OBJ_ACTIVE bit0) is
 * set; inactive records are skipped.
 *
 * For an active record, bit3 of OBJ_STATE picks the direction. Both directions move one
 * pixel per pass, and larger Y is lower on screen:
 *   - bit3 set  -> rising: OBJ_Y decreases. On reaching the top row (96) the object
 *     LANDS — its X snaps to a fixed column and OBJ_STATE becomes 4, which clears bit3
 *     so the next pass takes the falling arm.
 *   - bit3 clear -> falling: OBJ_Y increases. On reaching the bottom (248) the object
 *     DEACTIVATES — its active flag is cleared and it is no longer serviced.
 *
 * The record stride (16) is RETURNED, and that return is load-bearing: the spawn walk that
 * runs immediately after this one in the same service pass reuses the stride without
 * reloading it, so this routine's return value is that walk's stride.
 *
 * A LEAF: reads and writes only the six object records; calls nothing.
 *
 * What a record's behaviour depends on is only three of its bytes — bit 0 of the active
 * flag, bit 3 of the state byte, and the whole Y — and the six records are independent,
 * each field living inside its own 16-byte stride.
 *
 * LIVE-OUT: the six records' OBJ_Y / OBJ_ACTIVE / OBJ_X / OBJ_STATE in memory, plus the
 * record stride returned for the spawn walk.
 */

import { OBJ_ARRAY_66, OBJ_ACTIVE, OBJ_STATE, OBJ_X, OBJ_Y } from "./names.js";

const STRIDE = 0x10;          // object-record stride, 16 bytes
const RECORD_COUNT = 6;
const STATE_RISING = 0x08;    // OBJ_STATE bit3: set => rising toward the landing row
const RISE_LAND_Y = 96;       // a rising object lands when its Y reaches this
const FALL_GONE_Y = 248;      // a falling object deactivates when its Y reaches this
const LANDED_X = 119;         // X the object snaps to on landing
const LANDED_STATE = 0x04;    // OBJ_STATE after landing (bit3 clear => the next pass falls)

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {number} the object-record stride, which the spawn walk reuses as its own.
 */
export function advanceBoardObjectTravel(m) {
  const { mem } = m;

  for (let i = 0; i < RECORD_COUNT; i++) {
    const obj = OBJ_ARRAY_66 + i * STRIDE;

    // Skip inactive records.
    if ((mem.read8(obj + OBJ_ACTIVE) & 0x01) === 0) continue;

    if ((mem.read8(obj + OBJ_STATE) & STATE_RISING) !== 0) {
      // Rising: drift up one pixel; land when it reaches the top row.
      const y = mem.read8(obj + OBJ_Y) - 1;
      mem.write8(obj + OBJ_Y, y);
      if (y === RISE_LAND_Y) {
        mem.write8(obj + OBJ_X, LANDED_X);
        mem.write8(obj + OBJ_STATE, LANDED_STATE);
      }
    } else {
      // Falling: drift down one pixel; deactivate when it reaches the bottom.
      const y = mem.read8(obj + OBJ_Y) + 1;
      mem.write8(obj + OBJ_Y, y);
      if (y === FALL_GONE_Y) mem.write8(obj + OBJ_ACTIVE, 0x00);
    }
  }

  return STRIDE;
}
