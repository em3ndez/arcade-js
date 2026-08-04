// SPDX-License-Identifier: GPL-3.0-only
/**
 * resetReactionState — reset the per-object reaction state machine to idle and seed its
 * companion control bytes at round start, then hand off to the dig-object /
 * round-parameter seeding chain.  ROM 0x24cf.
 *
 * An entry point into the start-of-round seeding chain, one hand-off above
 * seedDigObjectBlock. It puts the per-object reaction state machine back into its rest
 * state — no reaction armed, its step timer cleared, its step period set — and
 * sets a small group of companion control bytes to fixed start values, then
 * tail-jumps into seedDigObjectBlock (which seeds the dig-object control block and continues
 * into the round/level parameter chain). The hand-off is a tail jump: seedDigObjectBlock's
 * chain returns straight to resetReactionState's caller, so the delegation IS resetReactionState's exit.
 *
 * Every write lands on a distinct work-RAM byte, so their order does not matter.
 *
 * Named by effect: resets the reaction state machine to idle before the dig-object /
 * round-parameter seeding chain.
 *
 * Memory-equivalent to the frozen oracle — equivalence-24cf.test.js.
 * GATE:     crafted-entry — never dispatched in attract (it runs only from gameplay
 *           round init, which attract never reaches), so it is validated on real
 *           captured attract machine states. Its own body reads NOTHING from the
 *           entry state (all fixed immediates), so any realistic state is a valid
 *           entry: EQUAL over several captured states + a sentinel-preset entry that
 *           makes every write observable, and the teeth twins are caught.
 * LIVE-OUT: memory-only — the seeded reaction/companion bytes plus the whole tail's
 *           effects. The round-init caller consumes the seeded memory, not any
 *           register; the tail owns everything after the hand-off.
 * NAMES:    REACTION_STATE, REACTION_TIMER, REACTION_OBJ_X, REACTION_OBJ_Y,
 *           REACTION_OBJ_ATTR from names.js. The reaction step-period byte is REACTION_PERIOD (0x80a3);
 *           one companion byte is LASER_STATE (0x80a1), the other (0x809c) is still unnamed and
 *           stays hex. The tail is the decompiled seedDigObjectBlock.
 */

import { seedDigObjectBlock } from "./seedDigObjectBlock.js";
import { REACTION_OBJ_X, REACTION_OBJ_Y, REACTION_STATE, REACTION_TIMER, REACTION_OBJ_ATTR, REACTION_PERIOD } from "./names.js";

export function resetReactionState(m) {
  const { mem8 } = m;

  // Reset the per-object reaction state machine to its rest state.
  mem8[REACTION_STATE] = 0; // idle — no reaction armed
  mem8[REACTION_TIMER] = 0; // reaction step timer cleared
  mem8[REACTION_PERIOD] = 24; // reaction step period (the reload value)

  // Seed the companion control bytes to their fixed start values.
  mem8[0x80a1] = 1;
  mem8[REACTION_OBJ_X] = 0;
  mem8[REACTION_OBJ_ATTR] = 3;
  mem8[REACTION_OBJ_Y] = 0;
  mem8[0x809c] = 1;

  // Tail hand-off into seedDigObjectBlock (dig-object control-block seed + round/level
  // parameter chain); its chain returns to our caller, so this is resetReactionState's exit.
  return seedDigObjectBlock(m);
}
