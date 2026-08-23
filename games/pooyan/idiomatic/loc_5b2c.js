// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_5b71 } from "./loc_5b71.js";
import {
  LANE_SPAWN_COUNTDOWN,
  ACTIVE_LANE_COUNT,
  loc_8d77,
  ROUND_COUNTER,
  ENEMY_ACTOR_TABLE,
  LAUNCH_ARM_LATCH,
} from "./names.js";
/**
 * loc_5b2c — end-of-wave object-table cleanup.
 *
 * Gated: does nothing while the launch-arm latch is clear or the active-lane count is still nonzero.
 * When the pending flag is zero it first scans six enemy records' +4 field for the wave-end key
 * (0x13, or 0x0b on an odd round) and returns on a clean miss. On a hit — or when the pending flag
 * is already set — it sweeps six enemy records through the per-record fire gate, then clears the
 * launch-arm latch and the launch latch.
 *
 * LIVE-OUT: none — the caller reads only memory back. The saved-register bank around each fire-gate
 * call only parks the loop counter/stride, which are JS locals here, so it dissolves away.
 */

const STRIDE = 0x18; //         enemy-record pitch
const RECORD_COUNT = 0x06; //   records scanned/swept
const KEY_FIELD = 0x04; //      record+4 holds the wave-end key
const KEY_EVEN = 0x13; //       wave-end key on an even round (round-counter bit0 clear)
const KEY_ODD = 0x0b; //        wave-end key on an odd round

export function loc_5b2c(m) {
  const { mem8 } = m;

  if (mem8[LANE_SPAWN_COUNTDOWN] === 0) return; // latch clear -> nothing to clean
  if (mem8[ACTIVE_LANE_COUNT] !== 0) return; // lane sequence still running -> wait

  if (mem8[loc_8d77] === 0) {
    const key = mem8[ROUND_COUNTER] & 0x01 ? KEY_ODD : KEY_EVEN;
    let scan = ENEMY_ACTOR_TABLE + KEY_FIELD;
    let hit = false;
    for (let i = 0; i < RECORD_COUNT; i++) {
      if (mem8[scan] === key) { hit = true; break; }
      scan = u16(scan + STRIDE);
    }
    if (!hit) return; // scanned all six, no wave-end key
  }

  let rec = ENEMY_ACTOR_TABLE;
  for (let i = 0; i < RECORD_COUNT; i++) {
    loc_5b71(m, rec); // fire gate for this record
    rec = u16(rec + STRIDE);
  }
  mem8[LANE_SPAWN_COUNTDOWN] = 0x00;
  mem8[LAUNCH_ARM_LATCH] = 0x00;
}
