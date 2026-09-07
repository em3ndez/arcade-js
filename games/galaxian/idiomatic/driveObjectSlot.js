// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveObjectSlot (ROM 0x0cd6) -- the per-slot object dispatcher of the enemy state machine.
 *
 * WHAT IT IS
 *   Given one object record (addressed by IX), this routine routes it to the right behavior for this
 *   frame. It checks the record's flag/state fields and does exactly one of three things:
 *     - dying object (record+1 bit0 set): tail-hand off to the death-animation dispatcher;
 *     - inactive slot (record+0 bit0 clear): do nothing;
 *     - active object: run the object-AI handler selected by the record's state index (record+2, 0..15).
 *
 * ROLE IN THE MACHINE
 *   Called once per record by driveAllObjectSlots (0x0cc3), which walks the eight object records at
 *   SPRITE_SOURCE_OBJ_BASE (0x42b0). This is the object state machine's dispatcher (mechanisms.md "The
 *   object-AI driver and its state handlers"). In the original Z80 the state index selected a target
 *   through an inline rst-28 word table (one word per state); that jump table is absorbed here into the
 *   STATE_HANDLERS array below, and the matching handler is direct-called in its place. The dying-object
 *   branch defers to dispatchDeactivatedObjectAnim (0x10e4), which sub-dispatches the death-animation
 *   phases.
 *
 * THE SIXTEEN OBJECT-AI STATES (index -> handler), the attacker life-cycle:
 *    0 initSpawnedObjectFromGridCell    -- first tick of a freshly launched object (position, seed motion)
 *    1 advanceObjectPathStep            -- walk the per-object cursor through the path-step table
 *    2 advanceActorPhaseAndCommitMove   -- pick the next horizontal target and commit the move
 *    3 advanceObjectFlightAndFire       -- run the swoop flight curve and fire an aimed shot on row match
 *    4 advanceObjectDiveStep            -- step the diving object down and fold the flight curve into Y
 *    5 reseedFormationObjectState       -- re-initialise at the left edge / roll a fresh random Y
 *    6 settleObjectIntoFormationCell    -- settle the object back into its formation cell
 *    7 homeObjectXTowardPlayer          -- home the object's X toward the player
 *    8 armDirectedMoveWhenInWindow      -- arm a directed move once the object is in its window
 *    9 advanceHomingObjectFlightAndFire -- homing sibling of state 3's swoop-and-fire
 *   10 advanceObjectPathStepDescending  -- path-step walk, descending variant
 *   11 advanceObjectPathStepAlias       -- path-step walk that reads the record via the register bridge
 *   12 restartObjectMoveRun             -- restart the object's move run
 *   13 initObjectPhaseSteps             -- initialise the object's phase-step counters
 *   14 advanceObjectAndQueueMessageColumn -- tick/dwell, then enqueue a message-column command word
 *   15 settleObjectXAtRest              -- settle the object's X to rest
 *
 * Grounding: [seen] (names.js cert for 0x0cd6).
 *
 * LIVE-OUT: whichever branch ran returns that callee's result; IX is re-seated to the record before the
 *   dying-object and active-handler calls (see R37 note below). An inactive slot returns nothing.
 */
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

export function driveObjectSlot(m, record = m.regs.ix) {
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
