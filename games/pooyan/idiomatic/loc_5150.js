// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_0c45 } from "./loc_0c45.js";
import {
  SCRIPT_ADVANCE_GUARD,
  ROUND_COUNTER,
  STAGE_COUNTDOWN,
  SCRIPT_ROW_TABLE,
  SCRIPT_DATA_TABLE_A,
  SCRIPT_DATA_TABLE_B,
  SCRIPT_VALUE_BYTE,
  SCRIPT_DELAY_TIMER,
  SCRIPT_DATA_PTR,
  ALT_TARGET_TABLE_PTR,
  SLOT_SPAWN_INDEX,
  LANE_RESET_LATCH,
} from "./names.js";
/**
 * loc_5150 — advance the attract/board script once its guard clears.
 *
 * Returns while SCRIPT_ADVANCE_GUARD is nonzero. Otherwise picks the round's script row (word
 * table SCRIPT_ROW_TABLE, index ROUND_COUNTER & 0x0f), then scans that row's stride-2
 * {threshold,value} records for the one whose threshold equals STAGE_COUNTDOWN; bails when the
 * stage is below 7 or past the last matching record. On a match it latches the guard and the row's
 * value byte, resolves two data pointers (tables SCRIPT_DATA_TABLE_A / _B, indexed by the value)
 * into SCRIPT_DATA_PTR / ALT_TARGET_TABLE_PTR, and clears the spawn/reset cells.
 * LIVE-OUT: none (memory only).
 */
const STAGE_FLOOR = 0x07; //   stages below this do not advance the script
const ROUND_MASK = 0x0f; //    round index into the row table
const RECORD_STRIDE = 2; //    {threshold, value} record pitch

export function loc_5150(m) {
  const { mem8 } = m;
  if (mem8[SCRIPT_ADVANCE_GUARD] !== 0) return; // script busy

  let row = loc_0c45(m, mem8[ROUND_COUNTER] & ROUND_MASK, SCRIPT_ROW_TABLE);
  const stage = mem8[STAGE_COUNTDOWN];
  if (stage < STAGE_FLOOR) return; // stage below 7

  // scan the row for the record whose threshold matches the stage; bail once the stage overshoots it
  for (;;) {
    const threshold = mem8[row];
    if (stage === threshold) break; // match
    if (stage >= threshold) return; // past the last matching record
    row = u16(row + RECORD_STRIDE);
  }

  mem8[SCRIPT_ADVANCE_GUARD] = stage; // latch the guard at the matched threshold
  const value = mem8[u16(row + 1)];
  mem8[SCRIPT_VALUE_BYTE] = value;

  const dataA = loc_0c45(m, value, SCRIPT_DATA_TABLE_A);
  mem8[SCRIPT_DELAY_TIMER] = mem8[dataA];
  const ptr = u16(dataA + 1);
  mem8[SCRIPT_DATA_PTR] = ptr; // low byte (the store truncates)
  mem8[SCRIPT_DATA_PTR + 1] = ptr >> 8;

  const dataB = loc_0c45(m, value, SCRIPT_DATA_TABLE_B);
  mem8[ALT_TARGET_TABLE_PTR] = dataB; // low byte
  mem8[ALT_TARGET_TABLE_PTR + 1] = dataB >> 8;

  mem8[SLOT_SPAWN_INDEX] = 0x00;
  mem8[LANE_RESET_LATCH] = 0x00;
}
