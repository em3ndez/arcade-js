// SPDX-License-Identifier: GPL-3.0-only
import { loc_33bd } from "./loc_33bd.js";
import { loc_3423 } from "./loc_3423.js";
import { tickActorHoldThenBlankAndClearWaveLatches } from "./tickActorHoldThenBlankAndClearWaveLatches.js";
import { advanceActorTowardTargetColumn } from "./advanceActorTowardTargetColumn.js";
import { advanceActorStateOnTimerWithTamperCheck } from "./advanceActorStateOnTimerWithTamperCheck.js";
import { advanceEnemyActorMotion } from "./advanceEnemyActorMotion.js";
import { advanceEnemyToArrivalAndTallyWave } from "./advanceEnemyToArrivalAndTallyWave.js";
import { loc_3c92 } from "./loc_3c92.js";
import { armEnemyState8Animation } from "./armEnemyState8Animation.js";
import { advanceEnemyAnimationPhase } from "./advanceEnemyAnimationPhase.js";
import { blankEnemyBandOnTimerExpiry } from "./blankEnemyBandOnTimerExpiry.js";
import { seedEnemyFromDescriptorAndEnterFlight } from "./seedEnemyFromDescriptorAndEnterFlight.js";
import { advanceInFlightEnemyAndLand } from "./advanceInFlightEnemyAndLand.js";
import { startEnemyFall } from "./startEnemyFall.js";
import { loc_3f72 } from "./loc_3f72.js";
import { advanceFallingEnemyAndTallyCatchOnLanding } from "./advanceFallingEnemyAndTallyCatchOnLanding.js";
import { verifyRomChecksum } from "./verifyRomChecksum.js";

/**
 * dispatchActiveEnemyActorState — low-state per-record dispatcher.
 *
 * Runs only when the record is active (bit0 of (ix+0)|(ix+1) set) and its state (ix+2)&0x1f is
 * below 0x11; then runs the handler for that state, passing the record base. The handler returns to
 * this routine's caller. LIVE-OUT: none — a void dispatch.
 */

const ACTIVE_BIT = 0x01;
const STATE_MASK = 0x1f;
const STATE_LIMIT = 0x11;

export function dispatchActiveEnemyActorState(m, rec = m.regs.ix) {
  const { mem8 } = m;
  if (((mem8[rec + 0] | mem8[rec + 1]) & ACTIVE_BIT) === 0) return; // inactive slot
  const state = mem8[rec + 2] & STATE_MASK;
  if (state >= STATE_LIMIT) return; // index out of range
  switch (state) {
    case 0x00: return loc_33bd(m, rec);
    case 0x01: return loc_3423(m, rec);
    case 0x02: return tickActorHoldThenBlankAndClearWaveLatches(m, rec);
    case 0x03: return advanceActorTowardTargetColumn(m, rec);
    case 0x04: return advanceActorStateOnTimerWithTamperCheck(m, rec);
    case 0x05: return advanceEnemyActorMotion(m, rec);
    case 0x06: return advanceEnemyToArrivalAndTallyWave(m, rec);
    case 0x07: return loc_3c92(m, rec);
    case 0x08: return armEnemyState8Animation(m, rec);
    case 0x09: return advanceEnemyAnimationPhase(m, rec);
    case 0x0a: return blankEnemyBandOnTimerExpiry(m, rec);
    case 0x0b: return seedEnemyFromDescriptorAndEnterFlight(m, rec);
    case 0x0c: return advanceInFlightEnemyAndLand(m, rec);
    case 0x0d: return startEnemyFall(m, rec);
    case 0x0e: return loc_3f72(m, rec);
    case 0x0f: return advanceFallingEnemyAndTallyCatchOnLanding(m, rec);
    case 0x10: return verifyRomChecksum(m);
  }
}
