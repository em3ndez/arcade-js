// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_72e1 } from "./loc_72e1.js";
import { loc_73e3 } from "./loc_73e3.js";
import { loc_72cf } from "./loc_72cf.js";
import {
  WAVE_LAUNCH_FLAG,
  WAVE_RECORD_COUNT,
  WAVE_INDEX,
  ENEMY_ACTOR_TABLE,
} from "./names.js";
/**
 * loc_72a7 — the enemy-wave launch driver, run once per frame.
 *
 * Three states, selected by two flags:
 *   - launch flag clear   -> seed the next wave, then return.
 *   - record count zero    -> tail-hand-off to the inter-wave idle handler.
 *   - otherwise            -> walk the wave's live records (two per wave index) through the
 *                             per-record state handler, one at a time.
 *
 * The record walk parks its own loop state across each handler call (the frozen layer used the
 * alternate register set for this); here the loop counter and the record cursor are plain locals.
 * A record count derived as zero means a full 256-record pass, matching the 8-bit down-counter.
 *
 * LIVE-OUT: memory only. The idle-handler branch is a faithful tail hand-off, so that handler's
 * own register result rides straight out through this routine's caller.
 */

const RECORD_STRIDE = 0x18; // spacing between adjacent records in the enemy-actor table

export function loc_72a7(m) {
  const { mem8 } = m;

  if (mem8[WAVE_LAUNCH_FLAG] === 0) {
    loc_72e1(m); // not launched yet -> seed the next wave
    return;
  }

  if (mem8[WAVE_RECORD_COUNT] === 0) return loc_73e3(m); // no records -> idle handler

  let rec = ENEMY_ACTOR_TABLE;
  let count = (mem8[WAVE_INDEX] * 2) & 0xff; // two records per wave index; 0 -> a full 256-pass loop
  do {
    loc_72cf(m, rec);
    rec = u16(rec + RECORD_STRIDE);
    count = (count - 1) & 0xff;
  } while (count !== 0);
}
