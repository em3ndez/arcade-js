// SPDX-License-Identifier: GPL-3.0-only
import { spawnObjectGatedByArmedActorCount } from "./spawnObjectGatedByArmedActorCount.js";

/**
 * enterPreSpawnGateIfBelowLimit — pre-spawn guard.
 *
 * When B is below 0x20, tail to the frozen pre-spawn gate; otherwise bail. Reached by tail-jump
 * from the target-tile resolver, so both the bail and the tail run in that caller's frame.
 * LIVE-OUT: none — a dispatched state handler; the caller reloads A and reads no register back. On the
 * bail path A holds B as a harmless value result; the tail path forwards the frozen gate's result.
 */

const B_LIMIT = 0x20;

export function enterPreSpawnGateIfBelowLimit(m, b = m.regs.b, rec = m.regs.ix) {
  if (b >= B_LIMIT) return (m.regs.a = b); // bail: A = B
  return spawnObjectGatedByArmedActorCount(m, rec); // tail to the pre-spawn gate
}
