// SPDX-License-Identifier: GPL-3.0-only
/**
 * reseedMoverCadenceAndRearmState — periodic refresh: reseed the random/animation byte and re-arm the actor state byte.
 *
 * Reached on the mover's rare periodic tick (once every 256 ticks). A fresh pseudo-random
 * draw is forced into the upper half of the byte range and stored as this cycle's random/
 * animation seed; the actor state/timer byte is re-armed to a fixed restart value of 9.
 * Both bytes are only weakly identified, so the name stays mechanism-level.
 */

import { advanceRandom } from "./advanceRandom.js";
import { ENEMY_ACTION_TIMER, ENEMY_WORK_SPRITE } from "./names.js";

export function reseedMoverCadenceAndRearmState(m) {
  // A fresh generator draw forced into the upper half (high bit set) becomes the seed.
  const seed = advanceRandom(m) | 0x80;
  m.mem8[ENEMY_ACTION_TIMER] = seed;

  // Re-arm the actor state/timer byte to its fixed restart value.
  m.mem8[ENEMY_WORK_SPRITE] = 9;

  // Leave 9 in the accumulator in case a caller reads it back.
  return (m.regs.a = 9);
}
