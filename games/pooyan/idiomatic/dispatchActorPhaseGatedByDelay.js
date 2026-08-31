// SPDX-License-Identifier: GPL-3.0-only
import { dispatchEndOfMoveIfFlagged } from "./dispatchEndOfMoveIfFlagged.js";
import { resolveActorTargetUnlessCommitted } from "./resolveActorTargetUnlessCommitted.js";
import { spawnObjectGatedByArmedActorCount } from "./spawnObjectGatedByArmedActorCount.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import {
  WAVE_PROGRESS_COUNTER,
  ACTOR_DELAY_COUNTER,
  ROUND_COUNTER,
  DELAY_RELOAD_TABLE_368E,
} from "./names.js";
/**
 * dispatchActorPhaseGatedByDelay — phase dispatch for the actor record at IX, gated by a per-actor delay.
 *
 * WHAT IT IS
 * ----------
 * One fork in the enemy-actor state machine. Every active enemy (a descending wolf) owns a
 * fixed-stride record; the byte at record+0x06 is its PHASE — a small state number that names
 * which behaviour handler should drive that actor this frame. This routine reads the phase byte
 * and steers the actor to one of three handlers, but two gates stand in front of the middle band:
 * a global wave-progress gate and a per-actor countdown delay together decide whether a
 * middle-band actor is even allowed to act on this pass.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * Run once per enemy record while the frame's actor walk visits each slot. The phase byte splits
 * the enemy's life into three bands:
 *   - LOW band (phase < 0x07): a freshly-arrived / settling actor -> the end-of-move guard.
 *   - HIGH band (phase >= 0x14): an actor choosing or holding its target -> the target resolver.
 *   - MIDDLE band (0x07..0x13): the paced part of the life. Here the wave-progress gate can freeze
 *     the lower phases once the wave is far enough along, and the per-actor delay meters how often
 *     the actor advances; when the delay elapses for a near-half actor the delay is reloaded and
 *     control drops into the pre-spawn gate.
 *
 * ROM: 0x362d-0x365c.
 * Grounding: [seen].
 *
 * LIVE-OUT: none — a dispatched state handler; the caller reloads A and reads no register back. The
 * early returns still assign A as a harmless value result (phase byte, pre-decrement delay, or xPos);
 * the tail branches forward their delegate's effects. xPos is the actor X the caller left in B.
 */

// Phase-band boundaries (values of the record+0x06 phase byte):
//   PHASE_LOW    — below this the actor is in the LOW band (end-of-move guard).
//   PHASE_HIGH   — at/above this the actor is in the HIGH band (target resolver).
//   PHASE_GATED  — the single middle-band phase the wave-progress gate lets through.
//   PROGRESS_GATE — the WAVE_PROGRESS_COUNTER threshold that freezes the lower middle phases.
//   X_NEAR_LIMIT — screen-X midpoint: below it is the near half, at/above it the far half.
const PHASE_LOW = 0x07;
const PHASE_HIGH = 0x14;
const PHASE_GATED = 0x13;
const PROGRESS_GATE = 0x0e;
const X_NEAR_LIMIT = 0x80;

export function dispatchActorPhaseGatedByDelay(m, rec = m.regs.ix, xPos = m.regs.b) {
  const { mem8 } = m;

  // Read the actor's PHASE (record+0x06) and split it into the three bands. The two band edges
  // are checked first so the middle-band gating below only ever sees phases 0x07..0x13.
  const phase = mem8[rec + 0x06];
  // LOW band: a settling actor goes to the end-of-move guard, which itself gates on record+0x08 bit0.
  if (phase < PHASE_LOW) return dispatchEndOfMoveIfFlagged(m, rec);
  // HIGH band: a committed/targeting actor goes to the target resolver.
  if (phase >= PHASE_HIGH) return resolveActorTargetUnlessCommitted(m, rec);

  // MIDDLE band — global progress gate. Once the wave has advanced far enough
  // (WAVE_PROGRESS_COUNTER / 0x8d7d has climbed to PROGRESS_GATE) the lower middle phases are
  // frozen: any actor still below PHASE_GATED bails for this frame, returning its phase byte in A.
  // Only phase 0x13 slips past the gate and reaches the delay/spawn logic below.
  if (mem8[WAVE_PROGRESS_COUNTER] >= PROGRESS_GATE && mem8[rec + 0x06] < PHASE_GATED)
    return (m.regs.a = mem8[rec + 0x06]);

  // Per-actor delay countdown at ACTOR_DELAY_COUNTER (0x8d6b). While the delay is non-zero the
  // actor is idle this frame: decrement it and return, handing back the pre-decrement value in A.
  // This is what paces the middle-band advance instead of letting it run every frame.
  const delay = mem8[ACTOR_DELAY_COUNTER];
  if (delay !== 0) {
    mem8[ACTOR_DELAY_COUNTER] = delay - 1;
    return (m.regs.a = delay);
  }

  // Delay elapsed. Only near-half actors reload and act: an actor whose X (xPos, from B) is in the
  // far half (>= X_NEAR_LIMIT) bails without reloading, returning its X in A. A near-half actor
  // reloads its delay from DELAY_RELOAD_TABLE_368E (0x368e), indexed by the low 3 bits of
  // ROUND_COUNTER (0x8907) so the cadence varies with the round, then falls into the pre-spawn gate.
  if (xPos >= X_NEAR_LIMIT) return (m.regs.a = xPos);
  const idx = mem8[ROUND_COUNTER] & 0x07;
  const [reload] = fetchByteFromTableIndex(m, DELAY_RELOAD_TABLE_368E, idx);
  mem8[ACTOR_DELAY_COUNTER] = reload;
  return spawnObjectGatedByArmedActorCount(m, rec);
}
