// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceDormantMover — mover housekeeping: advance two cadence counters each call.
 *
 * Called once per mover update to keep two counters ticking. The free-running tick counter
 * ENEMY_WORK_STATE is bumped every call; once every 256 calls it wraps to zero, and on that beat
 * the routine hands off to the periodic refresh (reseed the random/animation byte, re-arm the
 * actor state byte) and is done. On every other call it acts only on every 4th tick, advancing
 * the slower counter ENEMY_WORK_ATTR while holding that counter's bit 3 clear. The name stays
 * neutral: the slower counter has no confirmed game role a routine name could claim.
 */

import { reseedMoverCadenceAndRearmState } from "./reseedMoverCadenceAndRearmState.js";
import { ENEMY_WORK_STATE, ENEMY_WORK_ATTR } from "./names.js";


export function advanceDormantMover(m) {
  const { mem8 } = m;

  // Bump the free-running tick counter every call.
  const tick = (mem8[ENEMY_WORK_STATE] + 1) % 256;
  mem8[ENEMY_WORK_STATE] = tick;

  // Once every 256 calls the counter wraps back to zero; on that beat, run the
  // periodic refresh and stop for this call.
  if (tick === 0) {
    reseedMoverCadenceAndRearmState(m);
    return;
  }

  // Otherwise act only on every 4th tick; the other three do nothing.
  if (tick % 4 !== 0) return;

  // On the 4th tick, advance the slower second counter, holding its bit 3 clear.
  const second = (mem8[ENEMY_WORK_ATTR] + 1) & 0xf7;
  mem8[ENEMY_WORK_ATTR] = second;
}
