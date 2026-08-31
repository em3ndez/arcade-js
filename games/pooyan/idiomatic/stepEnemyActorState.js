// SPDX-License-Identifier: GPL-3.0-only
import { advanceActorStateOnTimerAndRestartAnim } from "./advanceActorStateOnTimerAndRestartAnim.js";
import { advanceEnemyCountdownThenRetireAndTickStage } from "./advanceEnemyCountdownThenRetireAndTickStage.js";
import { tickActorHoldThenBlankAndClearWaveLatches } from "./tickActorHoldThenBlankAndClearWaveLatches.js";
import { advanceEnemyTravelAndSpawnChildActors } from "./advanceEnemyTravelAndSpawnChildActors.js";
import { advanceActorStateOnTimerWithTamperCheck } from "./advanceActorStateOnTimerWithTamperCheck.js";
import { advanceRisingActorThenSettleOrArmDrop } from "./advanceRisingActorThenSettleOrArmDrop.js";
import { advanceEnemyToArrivalAndTallyWave } from "./advanceEnemyToArrivalAndTallyWave.js";
import { spawnFormationChildIntoFreeSlotOnTimer } from "./spawnFormationChildIntoFreeSlotOnTimer.js";
import { armEnemyState8AnimationAndTallyHudField } from "./armEnemyState8AnimationAndTallyHudField.js";
import { tickEnemyHoldThenTurnOrBlank } from "./tickEnemyHoldThenTurnOrBlank.js";
import { retireEnemyOnFrameTimerExpiry } from "./retireEnemyOnFrameTimerExpiry.js";
import { seedEnemyFromDescriptorAndEnterFlight } from "./seedEnemyFromDescriptorAndEnterFlight.js";
import { advanceInFlightEnemyAndLand } from "./advanceInFlightEnemyAndLand.js";
import { startEnemyFall } from "./startEnemyFall.js";
import { advanceObjectStateOnFrameTimerExpiry } from "./advanceObjectStateOnFrameTimerExpiry.js";
import { advanceFallingEnemyAndTallyCatchOnLanding } from "./advanceFallingEnemyAndTallyCatchOnLanding.js";
import { verifyRomChecksum } from "./verifyRomChecksum.js";

/**
 * stepEnemyActorState — the per-record state dispatcher for the enemy-actor arena.
 *
 * WHAT IT IS
 *   Every enemy that rides the ropes, every fountain/formation object, is a fixed 0x18-byte
 *   record in the actor arena. Each such record carries its own little state machine: a state
 *   index at record+0x02 that says which behaviour the actor is currently running. This routine
 *   takes one record and advances that record's state machine by exactly one frame — it decides
 *   whether the record should run at all, and if so which of seventeen behaviours to execute.
 *
 * ROLE IN THE MACHINE
 *   Once per worker frame the arena sweep (stepEnemyActorStates, ROM 0x1219) walks the 14 enemy
 *   records at ENEMY_ACTOR_TABLE (0x8ae0) in stride-0x18 order and hands each record in turn to
 *   this dispatcher. So this routine is called fourteen times a frame, once per enemy slot, and
 *   is the single point where a record's per-frame behaviour is actually selected and run.
 *
 * ROM
 *   0x122c-0x123c, with its 17-entry jump table inlined immediately after it at 0x123d.
 *
 * GROUNDING: [seen]
 *
 * LIVE-OUT
 *   The dispatcher itself writes nothing to memory; its only job is control flow — reject the
 *   record, or transfer into one behaviour handler. Whatever that handler leaves in the record
 *   (new state index, position, animation cursor, timers) is the live-out. The selected handler
 *   returns straight back to the sweep, which then moves on to the next record. Only memory
 *   changes here; the sweep reloads its own pointer and counter afterward, nothing is read back.
 */

// Record layout the dispatcher reads (offsets into the 0x18-byte actor record):
//   +0x00 / +0x01  presence header. The two bytes together are the liveness flag: a record is
//                  live only if bit 0 of (byte0 | byte1) is set. A dormant slot has both clear.
//   +0x02          state index — the actor's position in its own state machine.
// STATE_MASK folds the raw state byte to its low five bits (the hardware `and 0x1f`), and
// STATE_COUNT (17) is the number of valid states: a masked value at or past it is out of range.
const REC_ACTIVE_LO = 0x00;
const REC_ACTIVE_HI = 0x01;
const REC_STATE = 0x02;
const STATE_MASK = 0x1f;
const STATE_COUNT = 0x11;

// The 17-way behaviour table, mirroring the inline word table the hardware keeps at ROM 0x123d.
// The masked state index (0..0x10) selects one entry, and control transfers into that handler;
// it returns directly to the arena sweep. Each entry is one behaviour of the enemy state machine.
// The trailing number on each line is the state index; its ROM handler address is:
//   0->0x125f  1->0x1270  2->0x3536  3->0x12af  4->0x3865  5->0x1496  6->0x3be3  7->0x3c92
//   8->0x14dc  9->0x1518  10->0x154d 11->0x3e69 12->0x3e9c 13->0x3f5c 14->0x3f72 15->0x3f7c
//   16->0x3fe9
const HANDLERS = [
  advanceActorStateOnTimerAndRestartAnim, //                                  0
  advanceEnemyCountdownThenRetireAndTickStage, //                                  1
  tickActorHoldThenBlankAndClearWaveLatches, // 2
  advanceEnemyTravelAndSpawnChildActors, //                                  3
  advanceActorStateOnTimerWithTamperCheck, //   4
  advanceRisingActorThenSettleOrArmDrop, //                                  5
  advanceEnemyToArrivalAndTallyWave, //         6
  spawnFormationChildIntoFreeSlotOnTimer, //                                  7
  armEnemyState8AnimationAndTallyHudField, //                                  8
  tickEnemyHoldThenTurnOrBlank, //                                  9
  retireEnemyOnFrameTimerExpiry, //                                  10
  seedEnemyFromDescriptorAndEnterFlight, //     11
  advanceInFlightEnemyAndLand, //               12
  startEnemyFall, //                            13
  advanceObjectStateOnFrameTimerExpiry, //                                  14
  advanceFallingEnemyAndTallyCatchOnLanding, // 15
  verifyRomChecksum, //                         16
];

export function stepEnemyActorState(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Guard 1 — liveness (record+0x00 / +0x01). OR the two header bytes together and test bit 0:
  // if it is clear the slot holds no live actor this frame, so the record is skipped and its
  // state machine does not advance. This is how emptied and not-yet-spawned slots stay inert.
  if (((mem8[rec + REC_ACTIVE_LO] | mem8[rec + REC_ACTIVE_HI]) & 1) === 0) return;

  // Guard 2 — valid state (record+0x02). Read the state index and fold it to five bits; only
  // values 0..0x10 name a real behaviour. A masked value of 0x11 or higher has no handler, so
  // the record is skipped rather than indexed off the end of the table.
  const state = mem8[rec + REC_STATE] & STATE_MASK;
  if (state >= STATE_COUNT) return; // out-of-range sub-state -> skip

  // Dispatch — run the behaviour for this record's current state on this record. The handler
  // advances the record one frame (position, animation, timers, possibly its next state index)
  // and returns to the sweep, which then visits the following enemy slot.
  HANDLERS[state](m, rec);
}
