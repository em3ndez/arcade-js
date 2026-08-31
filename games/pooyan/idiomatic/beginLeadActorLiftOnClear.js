// SPDX-License-Identifier: GPL-3.0-only
import { seedFourRecordsAndCopyDisplayTiles } from "./seedFourRecordsAndCopyDisplayTiles.js";
import { queueSoundRun26 } from "./queueSoundRun26.js";
import {
  TAMPER_STRIKES_SLOTSWEEP,
  TAMPER_STRIKES_ROM,
  ACTOR_TABLE,
  ACTOR_TABLE_SLOT1,
  WAVE_TEARDOWN_STATE,
  SHAPE_TABLE_26BD,
} from "./names.js";
/**
 * beginLeadActorLiftOnClear — lead-actor state-0 handler for the actor arena (record based at IX = ACTOR_TABLE).
 *
 * Idles while either tamper-strike counter is nonzero. Once both are clear it seeds the record's
 * frame-delay field, advances its state, snapshots the whole lead record into the second actor
 * slot, drops the record's +4 position field by a row, and loads the shape table into the actor
 * records. It then queues the state's tile-run sound unless a wave teardown is in progress.
 *
 * LIVE-OUT: memory only — reached by tail dispatch from the per-frame driver, which reads nothing back.
 */

const FRAME_DELAY_SEED = 0x10; // record +0x11 frame-delay reload
const RECORD_LEN = 0x18; //       bytes copied when snapshotting the lead record
const POS_DROP = 0x10; //         amount subtracted from the record's +4 position field

export function beginLeadActorLiftOnClear(m, rec = m.regs.ix) {
  const { mem8 } = m;

  if ((mem8[TAMPER_STRIKES_SLOTSWEEP] | mem8[TAMPER_STRIKES_ROM]) !== 0) return; // still active

  mem8[rec + 0x11] = FRAME_DELAY_SEED;
  mem8[rec + 0x02] = mem8[rec + 0x02] + 1; // advance state
  for (let i = 0; i < RECORD_LEN; i++) mem8[ACTOR_TABLE_SLOT1 + i] = mem8[ACTOR_TABLE + i]; // snapshot
  mem8[rec + 0x04] = mem8[rec + 0x04] - POS_DROP; // drop the position field one row

  seedFourRecordsAndCopyDisplayTiles(m, SHAPE_TABLE_26BD, rec); // load the shape table into the actor records

  if (mem8[WAVE_TEARDOWN_STATE] !== 0) return;
  queueSoundRun26(m); // queue the state's tile-run sound
}
