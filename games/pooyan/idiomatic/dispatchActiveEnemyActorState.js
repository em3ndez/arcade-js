// SPDX-License-Identifier: GPL-3.0-only

// The seventeen per-state handlers this dispatcher can route an enemy record to.
// Each is one state of a single enemy actor's own state machine; the record's
// +0x02 state byte (masked to five bits) picks which one runs this frame. The
// handler names describe the state's job (spawn, glide, dive, fall, catch, ...);
// state 0x10 is the odd one out — an in-band ROM integrity check, not an actor
// behaviour, wedged into the last table slot.
import { advanceEnemyState0AndArmFlapReset } from "./advanceEnemyState0AndArmFlapReset.js";
import { dispatchActorState1MovementByMode } from "./dispatchActorState1MovementByMode.js";
import { tickActorHoldThenBlankAndClearWaveLatches } from "./tickActorHoldThenBlankAndClearWaveLatches.js";
import { advanceActorTowardTargetColumn } from "./advanceActorTowardTargetColumn.js";
import { advanceActorStateOnTimerWithTamperCheck } from "./advanceActorStateOnTimerWithTamperCheck.js";
import { advanceEnemyActorMotion } from "./advanceEnemyActorMotion.js";
import { advanceEnemyToArrivalAndTallyWave } from "./advanceEnemyToArrivalAndTallyWave.js";
import { spawnFormationChildIntoFreeSlotOnTimer } from "./spawnFormationChildIntoFreeSlotOnTimer.js";
import { armEnemyState8Animation } from "./armEnemyState8Animation.js";
import { advanceEnemyAnimationPhase } from "./advanceEnemyAnimationPhase.js";
import { blankEnemyBandOnTimerExpiry } from "./blankEnemyBandOnTimerExpiry.js";
import { seedEnemyFromDescriptorAndEnterFlight } from "./seedEnemyFromDescriptorAndEnterFlight.js";
import { advanceInFlightEnemyAndLand } from "./advanceInFlightEnemyAndLand.js";
import { startEnemyFall } from "./startEnemyFall.js";
import { advanceObjectStateOnFrameTimerExpiry } from "./advanceObjectStateOnFrameTimerExpiry.js";
import { advanceFallingEnemyAndTallyCatchOnLanding } from "./advanceFallingEnemyAndTallyCatchOnLanding.js";
import { verifyRomChecksum } from "./verifyRomChecksum.js";

/**
 * dispatchActiveEnemyActorState — low-state per-record enemy-actor dispatcher.
 *
 * WHAT IT IS
 *   ROM 0x338a-0x339a. Given one enemy-actor record (base pointer `rec`), this is
 *   the router that runs that record's current state for the frame. Every enemy in
 *   Pooyan — the wolves that ride ropes and dive at the player, plus the objects
 *   that spawn, glide, fall and get caught — is one record in the 0x18-byte-stride
 *   array based at ENEMY_ACTOR_TABLE (0x8ae0), and each record carries its own
 *   position in a small state machine in its +0x02 byte.
 *
 * ROLE IN THE MACHINE
 *   dispatchAllEnemyActorStates (0x3377) walks 14 records forward from 0x8ae0,
 *   stride 0x18, and hands each one here in turn; this routine advances exactly
 *   that one record's behaviour and returns, and the sweep moves to the next. So
 *   this is the innermost step of the per-frame enemy update: one call = one enemy
 *   advanced by one state-machine step.
 *
 * RECORD FIELDS IT READS
 *   +0x00 / +0x01 — the two-byte presence header (liveness).
 *   +0x02        — the state index (position in the actor's own state machine).
 *
 * Grounding: [seen]
 *
 * LIVE-OUT: none — a void dispatch. It writes nothing itself; any state change is
 *   made by the handler it delegates to, into that handler's own record fields.
 */

// Presence bit tested in the +0x00|+0x01 header: bit0 set == the record is live.
const ACTIVE_BIT = 0x01;
// The state index occupies the low five bits of +0x02; the upper bits carry
// unrelated per-actor flags and are masked away before dispatch.
const STATE_MASK = 0x1f;
// Only states 0x00..0x10 have a handler (17 entries). A masked state at or above
// this limit is out of range and the record is left untouched this frame.
const STATE_LIMIT = 0x11;

export function dispatchActiveEnemyActorState(m, rec = m.regs.ix) {
  const { mem8 } = m;
  // GUARD 1 — liveness. The two header bytes at rec+0x00 and rec+0x01 together
  // form the presence flag: OR them and test bit0. A record whose combined header
  // has bit0 clear is a dormant / empty slot, so it is skipped with no work done.
  if (((mem8[rec + 0] | mem8[rec + 1]) & ACTIVE_BIT) === 0) return; // inactive slot
  // Read the actor's current state from rec+0x02 and keep only the low five bits;
  // this masked value is the jump-table selector into the state machine below.
  const state = mem8[rec + 2] & STATE_MASK;
  // GUARD 2 — range. Anything masked to 0x11 or higher has no table entry, so the
  // record is left as-is rather than dispatched off the end of the handler table.
  if (state >= STATE_LIMIT) return; // index out of range
  // DISPATCH — route the record to the handler for its current state. Each handler
  // runs that state's per-frame behaviour on this same record (`rec`) and returns,
  // so control comes straight back out to the arena sweep that called us.
  switch (state) {
    case 0x00: return advanceEnemyState0AndArmFlapReset(m, rec);              // fresh/idle: step state 0 and arm the flap-reset
    case 0x01: return dispatchActorState1MovementByMode(m, rec);             // moving: pick the movement sub-mode and step it
    case 0x02: return tickActorHoldThenBlankAndClearWaveLatches(m, rec);     // hold: tick, then blank the band and clear wave latches
    case 0x03: return advanceActorTowardTargetColumn(m, rec);               // slide toward the resolved target tile-column
    case 0x04: return advanceActorStateOnTimerWithTamperCheck(m, rec);      // timer-gated advance, with an anti-tamper check
    case 0x05: return advanceEnemyActorMotion(m, rec);                      // apply this actor's per-frame motion
    case 0x06: return advanceEnemyToArrivalAndTallyWave(m, rec);            // reach arrival point and tally the wave counter
    case 0x07: return spawnFormationChildIntoFreeSlotOnTimer(m, rec);       // on timer, spawn a formation child into a free slot
    case 0x08: return armEnemyState8Animation(m, rec);                      // arm the state-8 animation
    case 0x09: return advanceEnemyAnimationPhase(m, rec);                   // step the animation phase
    case 0x0a: return blankEnemyBandOnTimerExpiry(m, rec);                  // on timer expiry, blank the enemy's sprite band
    case 0x0b: return seedEnemyFromDescriptorAndEnterFlight(m, rec);        // seed from the ROM descriptor and enter flight
    case 0x0c: return advanceInFlightEnemyAndLand(m, rec);                  // fly the enemy in and land it
    case 0x0d: return startEnemyFall(m, rec);                               // begin the falling phase
    case 0x0e: return advanceObjectStateOnFrameTimerExpiry(m, rec);         // frame-timer-gated object state advance
    case 0x0f: return advanceFallingEnemyAndTallyCatchOnLanding(m, rec);    // fall, and tally the catch when it lands
    case 0x10: return verifyRomChecksum(m);                                 // integrity slot: sum a ROM block, strike the tamper counter on deviation
  }
}
