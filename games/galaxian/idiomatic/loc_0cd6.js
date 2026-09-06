// SPDX-License-Identifier: GPL-3.0-only
// Per-slot object driver: for the object record at IX, hand a dying object to the death-animation
// dispatcher, skip an inactive one, else run the object-AI handler selected by the record's state index.
// The rst-28 inline word table (one word per state 0..15) is absorbed into the STATE_HANDLERS table
// below, each handler direct-called in place of the dispatch.
import { u16 } from "../../../core/int.js";
import { dispatchDeactivatedObjectAnim } from "./dispatchDeactivatedObjectAnim.js";
import { initSpawnedObjectFromGridCell } from "./initSpawnedObjectFromGridCell.js";
import { advanceObjectPathStep } from "./advanceObjectPathStep.js";
import { advanceActorPhaseAndCommitMove } from "./advanceActorPhaseAndCommitMove.js";
import { advanceObjectFlightAndFire } from "./advanceObjectFlightAndFire.js";
import { advanceObjectDiveStep } from "./advanceObjectDiveStep.js";
import { reseedFormationObjectState } from "./reseedFormationObjectState.js";
import { settleObjectIntoFormationCell } from "./settleObjectIntoFormationCell.js";
import { homeObjectXTowardPlayer } from "./homeObjectXTowardPlayer.js";
import { armDirectedMoveWhenInWindow } from "./armDirectedMoveWhenInWindow.js";
import { advanceHomingObjectFlightAndFire } from "./advanceHomingObjectFlightAndFire.js";
import { advanceObjectPathStepDescending } from "./advanceObjectPathStepDescending.js";
import { advanceObjectPathStepAlias } from "./advanceObjectPathStepAlias.js";
import { restartObjectMoveRun } from "./restartObjectMoveRun.js";
import { initObjectPhaseSteps } from "./initObjectPhaseSteps.js";
import { advanceObjectAndQueueMessageColumn } from "./advanceObjectAndQueueMessageColumn.js";
import { settleObjectXAtRest } from "./settleObjectXAtRest.js";

// Object-record field offsets (bytes from the record base in IX).
const ACTIVE_FLAG = 0; // record+0 bit0: object slot active
const DEATH_ANIM_FLAG = 1; // record+1 bit0: dying-object animation in progress
const STATE_INDEX = 2; // record+2: object-AI state selector (0..15)

// The 16 object-AI state handlers, indexed by STATE_INDEX — one entry per word of the absorbed
// rst-28 jump table.
const STATE_HANDLERS = [
  initSpawnedObjectFromGridCell, // 0
  advanceObjectPathStep, // 1
  advanceActorPhaseAndCommitMove, // 2
  advanceObjectFlightAndFire, // 3
  advanceObjectDiveStep, // 4
  reseedFormationObjectState, // 5
  settleObjectIntoFormationCell, // 6
  homeObjectXTowardPlayer, // 7
  armDirectedMoveWhenInWindow, // 8
  advanceHomingObjectFlightAndFire, // 9
  advanceObjectPathStepDescending, // 10
  advanceObjectPathStepAlias, // 11
  restartObjectMoveRun, // 12
  initObjectPhaseSteps, // 13
  advanceObjectAndQueueMessageColumn, // 14
  settleObjectXAtRest, // 15
];

export function loc_0cd6(m, record = m.regs.ix) {
  const { mem8 } = m;

  // Dying object: tail-hand off to the death-animation dispatcher (its return is this driver's return).
  if (mem8[u16(record + DEATH_ANIM_FLAG)] & 1) {
    return (m.regs.ix = record, dispatchDeactivatedObjectAnim(m, record));
  }

  // Inactive slot: nothing to do.
  if ((mem8[u16(record + ACTIVE_FLAG)] & 1) === 0) return;

  // Run the object-AI handler for this state. Re-seat IX to the record (R37) so a handler that reads it
  // via the register bridge (advanceObjectPathStepAlias) sees this record; the re-seat rides the return.
  const handler = STATE_HANDLERS[mem8[u16(record + STATE_INDEX)]];
  return (m.regs.ix = record, handler(m, record));
}
