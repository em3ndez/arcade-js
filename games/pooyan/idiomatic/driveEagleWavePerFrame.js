// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { seedNextEagleWave } from "./seedNextEagleWave.js";
import { tickEagleInterWaveHoldAndRearmLaunch } from "./tickEagleInterWaveHoldAndRearmLaunch.js";
import { dispatchActiveEagleRecordState } from "./dispatchActiveEagleRecordState.js";
import {
  WAVE_LAUNCH_FLAG,
  WAVE_RECORD_COUNT,
  WAVE_INDEX,
  ENEMY_ACTOR_TABLE,
} from "./names.js";
/**
 * driveEagleWavePerFrame — the eagle bonus-wave launch driver, run once per frame.
 *
 * WHAT IT IS
 *   The bonus stage runs its own attack pipeline, separate from the main-play enemy wave.
 *   During the wave-launch phase of that stage this routine is called every frame to advance
 *   the eagle wave: seed a fresh wave when there is none in flight, hold quietly between
 *   waves, and while a wave is live push each of its eagle records through their little
 *   per-record state machine (approach-and-arrive, then dive/climb, then despawn).
 *
 * ITS ROLE IN THE MACHINE
 *   A three-way fork on two flags in the bonus-stage state block:
 *     - launch flag clear  -> no wave is live yet: seed the next one, then return.
 *     - record count zero  -> a wave was live but has fully retired: hand off to the
 *                             inter-wave idle handler, which drains the hold timer and
 *                             eventually re-arms the launch flag so a new wave can be seeded.
 *     - otherwise          -> a wave is live: walk its records, one per iteration, through
 *                             the per-record state dispatcher.
 *   A wave carries two eagle records per wave index, so the walk length is 2 * WAVE_INDEX
 *   (0x8f3d). WAVE_INDEX advances 0->1->2->3->4 across the stage, so the live wave grows by
 *   two records each time it is re-seeded.
 *
 * ROM ADDRESS
 *   0x72a7-0x72ce.
 *
 * GROUNDING
 *   [seen]
 *
 * LIVE-OUT: memory only. Every effect this routine has on the world lands through the three
 *   callees, which write the bonus-stage state block and the eagle records in
 *   ENEMY_ACTOR_TABLE. The record count reached in the walk is an 8-bit down-count: a count
 *   derived as zero means a full 256-record pass, matching the underlying 8-bit counter.
 *   The idle-handler branch is a plain tail hand-off — that handler's own result rides
 *   straight out through this routine's caller unchanged.
 */

const RECORD_STRIDE = 0x18; // spacing between adjacent records in the enemy-actor table

export function driveEagleWavePerFrame(m) {
  const { mem8 } = m;

  // No wave is in flight yet. WAVE_LAUNCH_FLAG (0x8f3a) is raised only once a wave has been
  // seeded, so while it is clear the only work is to try to seed the next wave and return.
  // seedNextEagleWave initialises this wave's eagle records (and, on the fourth wave, instead
  // re-arms the outer phase and reloads the hold timer).
  if (mem8[WAVE_LAUNCH_FLAG] === 0) {
    seedNextEagleWave(m); // not launched yet -> seed the next wave
    return;
  }

  // A wave was launched but every one of its records has since retired: WAVE_RECORD_COUNT
  // (0x8f3c) reaching zero is the last record's despawn decrementing it to empty. Hand off to
  // the inter-wave idle handler, which drains the hold timer and, on expiry, clears the launch
  // flag so the branch above can seed the next wave. This is a tail hand-off: its result is
  // this routine's result.
  if (mem8[WAVE_RECORD_COUNT] === 0) return tickEagleInterWaveHoldAndRearmLaunch(m); // no records -> idle handler

  // A wave is live. Walk its records starting at the base of the enemy-actor table
  // (ENEMY_ACTOR_TABLE, 0x8ae0), stepping RECORD_STRIDE (0x18) bytes per record. The number of
  // records to walk is two per wave index (WAVE_INDEX, 0x8f3d); the & 0xff keeps this an 8-bit
  // value so a product of 0x80 or more that wraps, or a would-be 0x100, is handled as the ROM's
  // 8-bit down-counter does — a derived count of 0 means a full 256-record pass.
  let rec = ENEMY_ACTOR_TABLE;
  let count = (mem8[WAVE_INDEX] * 2) & 0xff; // two records per wave index; 0 -> a full 256-pass loop
  do {
    // Hand this record to the per-record state machine: it dispatches on the record's state
    // byte (rec+2) to approach-and-tally, dive/climb, or despawn the eagle.
    dispatchActiveEagleRecordState(m, rec);
    // Advance to the next record; u16 keeps the address wrapped to 16 bits like the ROM's index.
    rec = u16(rec + RECORD_STRIDE);
    // Decrement the 8-bit record down-counter and loop until it hits zero.
    count = (count - 1) & 0xff;
  } while (count !== 0);
}
