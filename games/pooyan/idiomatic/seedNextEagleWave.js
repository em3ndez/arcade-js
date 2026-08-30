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
 * seedNextEagleWave — begin the next eagle attack wave: populate the enemy-actor records for
 * this wave from the ROM parameter table, and advance the wave bookkeeping.
 *
 * ROM 0x72e1-0x733b. Grounding: [seen].
 *
 * ROLE. Eagles attack Pooyan in waves. Each wave arms a fresh batch of enemy records and lets
 * the per-frame eagle driver fly them; when the batch is spent, this routine is called again to
 * seed the next wave. It is GATED: it only seeds while the target slot is clear, so a wave in
 * flight is never overwritten.
 *
 * The bookkeeping cells live on the 0x8f page:
 *   - WAVE_INDEX (0x8f3d): the current wave number, bumped here and wrapping after the 4th.
 *   - WAVE_RECORD_COUNT (0x8f3c): how many records this wave arms — 2 per wave index.
 *   - WAVE_LAUNCH_FLAG (0x8f3a): raised to 1 so the per-frame driver knows a wave is live.
 *   - WAVE_OUTER_PHASE (0x8f38): an outer-loop phase counter, re-armed on the 4th wave and
 *     cleared once a normal wave finishes seeding.
 *   - WAVE_HOLD_TIMER (0x8f36): inter-wave hold countdown, reloaded on the 4th wave.
 *   - WAVE_RECORDS_ARRIVED (0x8f39): count of records that have arrived, cleared per new wave.
 *
 * Every fourth wave is special: instead of seeding records it just re-arms the outer phase and
 * reloads the hold timer, spacing the attack out before the pattern repeats.
 *
 * Otherwise it initialises WAVE_RECORD_COUNT records in ENEMY_ACTOR_TABLE (0x8ae0), each record
 * 0x18 bytes wide, drawing four bytes per record from EAGLE_WAVE_PARAM_TABLE (0x7409). Per
 * record it marks the record active and copies the four parameter bytes into fields +6, +0x10,
 * +4, +0x0f; a fixed flag byte goes into +5 always, and into +3 as well for records whose base
 * address has bit 3 set (alternating records, since the stride is 0x18). Field +3's flag thus
 * lands only on every other record.
 *
 * A leaf: touches only these cells and the record table, calls nothing.
 *
 * LIVE-OUT: memory only — the seeded enemy-actor records and the wave bookkeeping cells above.
 * The caller returns immediately after seeding.
 */

const FOURTH_WAVE = 0x04; //     the wave index that only re-arms (no record seeding)
const HOLD_RELOAD = 0x20; //     inter-wave hold-timer (WAVE_HOLD_TIMER, 0x8f36) reload value
const RECORD_STRIDE = 0x18; //   spacing between enemy-actor records in ENEMY_ACTOR_TABLE
const REC_ACTIVE = 0x01; //      record byte0 marked active (state 1)
const REC_FLAG = 0x80; //        fixed flag byte stored into record fields +3/+5
const LOW_ADDR_BIT3 = 0x08; //   bit 3 of a record's own low address (IXL) selects the +3 field

export function seedNextEagleWave(m) {
  const { mem8 } = m;

  // Gate: seed only while the target slot ENEMY_TARGET_REC0 (0x8c90) presence byte is clear.
  // A nonzero value means a wave/target is still live, so leave it undisturbed.
  if (mem8[ENEMY_TARGET_REC0] !== 0) return; // seed only while the target slot is clear

  // Announce a wave is live and advance to the next wave number. WAVE_LAUNCH_FLAG (0x8f3a) = 1
  // tells the per-frame eagle driver to fly this wave; WAVE_INDEX (0x8f3d) increments (byte-wide
  // wrap) to the wave we are about to seed.
  mem8[WAVE_LAUNCH_FLAG] = 1;
  const wave = (mem8[WAVE_INDEX] + 1) & 0xff;
  mem8[WAVE_INDEX] = wave;

  // Every fourth wave is a spacer: do NOT seed records. Instead bump the outer-phase counter
  // (WAVE_OUTER_PHASE, 0x8f38) and reload the inter-wave hold timer (WAVE_HOLD_TIMER, 0x8f36)
  // so the machine pauses before the wave pattern repeats.
  if (wave === FOURTH_WAVE) {
    mem8[WAVE_OUTER_PHASE] = mem8[WAVE_OUTER_PHASE] + 1; // re-arm the outer phase
    mem8[WAVE_HOLD_TIMER] = HOLD_RELOAD;
    return;
  }

  // Record count for this wave = 2 * wave index, stored in WAVE_RECORD_COUNT (0x8f3c). The
  // per-frame driver later walks this many records.
  const recordCount = (wave * 2) & 0xff; // two records per wave index
  mem8[WAVE_RECORD_COUNT] = recordCount;
  // The ROM loop is a djnz with B = recordCount: a count of 0 runs the full 256-pass loop
  // rather than none. No wave produces 0 in practice, but the count-then-loop matches the ROM.
  const iters = recordCount === 0 ? 256 : recordCount; // a zero count runs a full 256-pass loop

  // Walk the ROM parameter table (EAGLE_WAVE_PARAM_TABLE, 0x7409, 4 bytes per record) and the
  // enemy-actor record table (ENEMY_ACTOR_TABLE, 0x8ae0, stride 0x18) in lock-step, seeding one
  // record per pass.
  let param = EAGLE_WAVE_PARAM_TABLE;
  let rec = ENEMY_ACTOR_TABLE;
  for (let i = 0; i < iters; i++) {
    // Mark the record active (byte0 = 1) and copy the four parameter bytes into the record's
    // control/geometry fields: +6, +0x10, +4, +0x0f, consuming the parameter table in order.
    mem8[rec] = REC_ACTIVE;
    mem8[rec + 0x06] = mem8[param++];
    mem8[rec + 0x10] = mem8[param++];
    mem8[rec + 0x04] = mem8[param++];
    mem8[rec + 0x0f] = mem8[param++];
    // Field +3 gets the fixed flag only on records whose own low address has bit 3 set. Because
    // the stride is 0x18, that bit alternates, so +3's flag lands on every other record.
    if ((rec & LOW_ADDR_BIT3) !== 0) mem8[rec + 0x03] = REC_FLAG;
    // Field +5 always gets the fixed flag.
    mem8[rec + 0x05] = REC_FLAG;
    // Advance to the next record (16-bit wrap on the pointer, matching add ix,de).
    rec = u16(rec + RECORD_STRIDE);
  }

  // The ROM loads A from B after djnz drains it, so both stores below write 0. Clear the outer
  // phase (WAVE_OUTER_PHASE, 0x8f38) and the arrived-record count (WAVE_RECORDS_ARRIVED, 0x8f39)
  // to start this wave's arrival tracking from zero.
  mem8[WAVE_OUTER_PHASE] = 0; // B is 0 once the loop drains
  mem8[WAVE_RECORDS_ARRIVED] = 0;
}
