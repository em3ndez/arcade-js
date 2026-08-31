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
 * stepEnemyActorState — per-object state dispatcher, run once per record as the object array is walked.
 * Skips a record whose active flag (bit 0 of the two-byte header) is clear and any sub-state
 * at or past 0x11; otherwise selects a handler by the low 5 bits of the state byte and runs it
 * on this record. Only memory changes — the caller reloads its own registers, nothing is read back.
 */

const REC_ACTIVE_LO = 0x00;
const REC_ACTIVE_HI = 0x01;
const REC_STATE = 0x02;
const STATE_MASK = 0x1f;
const STATE_COUNT = 0x11;

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

  // Inactive record: active flag (bit 0 of the header) clear -> skip.
  if (((mem8[rec + REC_ACTIVE_LO] | mem8[rec + REC_ACTIVE_HI]) & 1) === 0) return;

  const state = mem8[rec + REC_STATE] & STATE_MASK;
  if (state >= STATE_COUNT) return; // out-of-range sub-state -> skip

  HANDLERS[state](m, rec);
}
