// SPDX-License-Identifier: GPL-3.0-only
import { loc_125f } from "./loc_125f.js";
import { loc_1270 } from "./loc_1270.js";
import { tickActorHoldThenBlankAndClearWaveLatches } from "./tickActorHoldThenBlankAndClearWaveLatches.js";
import { loc_12af } from "./loc_12af.js";
import { advanceActorStateOnTimerWithTamperCheck } from "./advanceActorStateOnTimerWithTamperCheck.js";
import { loc_1496 } from "./loc_1496.js";
import { advanceEnemyToArrivalAndTallyWave } from "./advanceEnemyToArrivalAndTallyWave.js";
import { loc_3c92 } from "./loc_3c92.js";
import { loc_14dc } from "./loc_14dc.js";
import { loc_1518 } from "./loc_1518.js";
import { loc_154d } from "./loc_154d.js";
import { seedEnemyFromDescriptorAndEnterFlight } from "./seedEnemyFromDescriptorAndEnterFlight.js";
import { advanceInFlightEnemyAndLand } from "./advanceInFlightEnemyAndLand.js";
import { startEnemyFall } from "./startEnemyFall.js";
import { loc_3f72 } from "./loc_3f72.js";
import { advanceFallingEnemyAndTallyCatchOnLanding } from "./advanceFallingEnemyAndTallyCatchOnLanding.js";
import { verifyRomChecksum } from "./verifyRomChecksum.js";

/**
 * loc_122c — per-object state dispatcher, run once per record as the object array is walked.
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
  loc_125f, //                                  0
  loc_1270, //                                  1
  tickActorHoldThenBlankAndClearWaveLatches, // 2
  loc_12af, //                                  3
  advanceActorStateOnTimerWithTamperCheck, //   4
  loc_1496, //                                  5
  advanceEnemyToArrivalAndTallyWave, //         6
  loc_3c92, //                                  7
  loc_14dc, //                                  8
  loc_1518, //                                  9
  loc_154d, //                                  10
  seedEnemyFromDescriptorAndEnterFlight, //     11
  advanceInFlightEnemyAndLand, //               12
  startEnemyFall, //                            13
  loc_3f72, //                                  14
  advanceFallingEnemyAndTallyCatchOnLanding, // 15
  verifyRomChecksum, //                         16
];

export function loc_122c(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Inactive record: active flag (bit 0 of the header) clear -> skip.
  if (((mem8[rec + REC_ACTIVE_LO] | mem8[rec + REC_ACTIVE_HI]) & 1) === 0) return;

  const state = mem8[rec + REC_STATE] & STATE_MASK;
  if (state >= STATE_COUNT) return; // out-of-range sub-state -> skip

  HANDLERS[state](m, rec);
}
