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
 * The record's phase byte routes the low range to the end-of-move guard and the high
 * range to the target resolver. In the middle band a global progress gate lets one phase return
 * early. Otherwise a per-actor delay counts down (returning while it runs); when it elapses and
 * the actor's X position is in the near half, the delay is reloaded from the round-selected table
 * and control falls into the pre-spawn gate.
 *
 * LIVE-OUT: none — a dispatched state handler; the caller reloads A and reads no register back. The
 * early returns still assign A as a harmless value result (phase byte, pre-decrement delay, or xPos);
 * the tail branches forward their delegate's effects. xPos is the actor X the caller left in B.
 */

const PHASE_LOW = 0x07;
const PHASE_HIGH = 0x14;
const PHASE_GATED = 0x13;
const PROGRESS_GATE = 0x0e;
const X_NEAR_LIMIT = 0x80;

export function dispatchActorPhaseGatedByDelay(m, rec = m.regs.ix, xPos = m.regs.b) {
  const { mem8 } = m;

  const phase = mem8[rec + 0x06];
  if (phase < PHASE_LOW) return dispatchEndOfMoveIfFlagged(m, rec);
  if (phase >= PHASE_HIGH) return resolveActorTargetUnlessCommitted(m, rec);

  // middle band: the progress gate short-circuits one phase (A = the phase byte)
  if (mem8[WAVE_PROGRESS_COUNTER] >= PROGRESS_GATE && mem8[rec + 0x06] < PHASE_GATED)
    return (m.regs.a = mem8[rec + 0x06]);

  // per-actor delay countdown (A = the pre-decrement delay)
  const delay = mem8[ACTOR_DELAY_COUNTER];
  if (delay !== 0) {
    mem8[ACTOR_DELAY_COUNTER] = delay - 1;
    return (m.regs.a = delay);
  }

  // delay elapsed: near-half actors reload the delay and enter the pre-spawn gate (A = xPos)
  if (xPos >= X_NEAR_LIMIT) return (m.regs.a = xPos);
  const idx = mem8[ROUND_COUNTER] & 0x07;
  const [reload] = fetchByteFromTableIndex(m, DELAY_RELOAD_TABLE_368E, idx);
  mem8[ACTOR_DELAY_COUNTER] = reload;
  return spawnObjectGatedByArmedActorCount(m, rec);
}
