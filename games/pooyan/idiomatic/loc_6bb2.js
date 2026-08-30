// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_0038 } from "./loc_0038.js";
import { loc_6bae } from "./loc_6bae.js";
import {
  PENDING_OBJECT_COUNTDOWN,
  PROMOTED_OBJECT_LIST,
  PLAY_STATE_INDEX,
  ATTRACT_HELP_CLEAR_DISPLAY_CMD_A,
} from "./names.js";

/**
 * loc_6bb2 — on a countdown tick, commit promoted-object values then repaint the help screen.
 *
 * Counts the pending-object timer down each call and returns until it underflows to zero. On that
 * tick it walks the 11 stride-3 records: each active record (its pointer's high byte nonzero) stores
 * the record's value byte six bytes past the little-endian pointer it holds. Then it marks the
 * play-state index and enqueues five help-clear display commands, the last of which tails into the
 * sprite-display-list rebuild.
 *
 * LIVE-OUT: memory only — the timer cell, the per-record target stores, the play-state index, and
 * the enqueued display ring / rebuilt display list. No register output.
 */

const RECORD_COUNT = 0x0b; //     records in the table
const RECORD_STRIDE = 0x03; //    bytes per record: [ptr_lo, ptr_hi, value]
const REC_PTR_HI = 0x01; //       record offset: pointer high byte (also the active flag)
const REC_VALUE = 0x02; //        record offset: value byte to store
const TARGET_BIAS = 0x06; //      added to the record pointer before the store
const PLAY_STATE_COMMIT = 0x04; // play-state index written after the scan

export function loc_6bb2(m) {
  const { mem8 } = m;

  const left = (mem8[PENDING_OBJECT_COUNTDOWN] - 1) & 0xff;
  mem8[PENDING_OBJECT_COUNTDOWN] = left;
  if (left !== 0) return;

  let rec = PROMOTED_OBJECT_LIST;
  for (let i = 0; i < RECORD_COUNT; i++, rec += RECORD_STRIDE) {
    const hi = mem8[rec + REC_PTR_HI];
    if (hi === 0) continue;
    const target = u16(((hi << 8) | mem8[rec]) + TARGET_BIAS);
    mem8[target] = mem8[rec + REC_VALUE];
  }

  mem8[PLAY_STATE_INDEX] = PLAY_STATE_COMMIT;

  loc_0038(m, ATTRACT_HELP_CLEAR_DISPLAY_CMD_A);
  loc_0038(m, ATTRACT_HELP_CLEAR_DISPLAY_CMD_A + 1);
  loc_0038(m, ATTRACT_HELP_CLEAR_DISPLAY_CMD_A + 2);
  loc_0038(m, ATTRACT_HELP_CLEAR_DISPLAY_CMD_A + 3);
  loc_6bae(m, ATTRACT_HELP_CLEAR_DISPLAY_CMD_A + 4);
}
