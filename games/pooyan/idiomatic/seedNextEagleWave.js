// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  ENEMY_TARGET_REC0,
  WAVE_LAUNCH_FLAG,
  WAVE_INDEX,
  WAVE_RECORD_COUNT,
  WAVE_OUTER_PHASE,
  WAVE_HOLD_TIMER,
  WAVE_RECORDS_ARRIVED,
  ENEMY_ACTOR_TABLE,
  EAGLE_WAVE_PARAM_TABLE,
} from "./names.js";
/**
 * seedNextEagleWave — seed the next eagle attack wave.
 *
 * Runs only while the target slot is clear. It raises the launch flag and advances the wave
 * index; on the fourth wave it merely re-arms the outer phase and reloads the hold timer.
 * Otherwise it initialises two records per wave in the enemy-actor table (stride 0x18) from
 * the four-byte-per-record parameter table — each record marked active with four copied
 * fields, records whose own low address has bit 3 set also get a flag field — then clears
 * the outer-phase and records-arrived counters.
 *
 * LIVE-OUT: memory only; the caller returns immediately after seeding.
 */

const FOURTH_WAVE = 0x04; //     the wave index that only re-arms (no record seeding)
const HOLD_RELOAD = 0x20; //     inter-wave hold-timer reload value
const RECORD_STRIDE = 0x18; //   spacing between enemy-actor records
const REC_ACTIVE = 0x01; //      record marked active (state 1)
const REC_FLAG = 0x80; //        fixed flag byte stored into record fields +3/+5
const LOW_ADDR_BIT3 = 0x08; //   bit 3 of a record's own low address selects the +3 field

export function seedNextEagleWave(m) {
  const { mem8 } = m;

  if (mem8[ENEMY_TARGET_REC0] !== 0) return; // seed only while the target slot is clear

  mem8[WAVE_LAUNCH_FLAG] = 1;
  const wave = (mem8[WAVE_INDEX] + 1) & 0xff;
  mem8[WAVE_INDEX] = wave;

  if (wave === FOURTH_WAVE) {
    mem8[WAVE_OUTER_PHASE] = mem8[WAVE_OUTER_PHASE] + 1; // re-arm the outer phase
    mem8[WAVE_HOLD_TIMER] = HOLD_RELOAD;
    return;
  }

  const recordCount = (wave * 2) & 0xff; // two records per wave index
  mem8[WAVE_RECORD_COUNT] = recordCount;
  const iters = recordCount === 0 ? 256 : recordCount; // a zero count runs a full 256-pass loop

  let param = EAGLE_WAVE_PARAM_TABLE;
  let rec = ENEMY_ACTOR_TABLE;
  for (let i = 0; i < iters; i++) {
    mem8[rec] = REC_ACTIVE;
    mem8[rec + 0x06] = mem8[param++];
    mem8[rec + 0x10] = mem8[param++];
    mem8[rec + 0x04] = mem8[param++];
    mem8[rec + 0x0f] = mem8[param++];
    if ((rec & LOW_ADDR_BIT3) !== 0) mem8[rec + 0x03] = REC_FLAG;
    mem8[rec + 0x05] = REC_FLAG;
    rec = u16(rec + RECORD_STRIDE);
  }

  mem8[WAVE_OUTER_PHASE] = 0; // B is 0 once the loop drains
  mem8[WAVE_RECORDS_ARRIVED] = 0;
}
