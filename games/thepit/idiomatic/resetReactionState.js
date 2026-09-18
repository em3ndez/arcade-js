// SPDX-License-Identifier: GPL-3.0-only
/**
 * resetReactionState — reset the per-object reaction state machine to idle and seed its
 * companion control bytes at round start, then tail-jump into the dig-object / round-parameter
 * seeding chain (seedDigObjectBlock), whose return goes straight to our caller. It puts the
 * reaction state machine back into its rest state — no reaction armed, step timer cleared,
 * step period set — and sets a small group of companion control bytes to fixed start values.
 * Every write lands on a distinct work-RAM byte, so their order does not matter.
 */

import { seedDigObjectBlock } from "./seedDigObjectBlock.js";
import { REACTION_OBJ_X, REACTION_OBJ_Y, REACTION_STATE, REACTION_TIMER, REACTION_OBJ_ATTR, REACTION_PERIOD, LASER_STATE } from "./names.js";

export function resetReactionState(m) {
  const { mem8 } = m;

  // Reset the reaction state machine to rest: idle, step timer cleared, step period reloaded.
  mem8[REACTION_STATE] = 0;
  mem8[REACTION_TIMER] = 0;
  mem8[REACTION_PERIOD] = 24;

  // Seed the companion control bytes to their fixed start values.
  mem8[LASER_STATE] = 1;
  mem8[REACTION_OBJ_X] = 0;
  mem8[REACTION_OBJ_ATTR] = 3;
  mem8[REACTION_OBJ_Y] = 0;
  mem8[0x809c] = 1;

  // Tail hand-off into the seeding chain; its return goes to our caller.
  return seedDigObjectBlock(m);
}
