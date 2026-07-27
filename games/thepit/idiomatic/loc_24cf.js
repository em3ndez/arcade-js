// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_24cf — reset the per-object reaction state machine to idle and seed its
 * companion control bytes at round start, then hand off to the dig-object /
 * round-parameter seeding chain.  ROM 0x24cf.
 *
 * An entry point into the start-of-round seeding chain, one hand-off above
 * loc_287a. It puts the per-object reaction state machine back into its rest
 * state — no reaction armed, its step timer cleared, its step period set — and
 * sets a small group of companion control bytes to fixed start values, then
 * tail-jumps into loc_287a (which seeds the dig-object control block and continues
 * into the round/level parameter chain). The hand-off is a tail jump: loc_287a's
 * chain returns straight to loc_24cf's caller, so the delegation IS loc_24cf's exit.
 *
 * Every write lands on a distinct work-RAM byte, so their order does not matter.
 *
 * Name kept as loc_24cf: like loc_287a below it, several of the companion bytes it
 * seeds (0x8096 / 0x809c / 0x80a1) sit at addresses whose subsystem role is not yet
 * confirmed, so the routine's overall role is a best-effort reading — below the bar
 * to promote to an English name.
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
 * NAMES:    REACTION_STATE, REACTION_TIMER, REACTION_OBJ_X, REACTION_OBJ_Y from
 *           ram.js. The reaction step-period byte (0x80a3) and the companion bytes
 *           (0x8096 / 0x809c / 0x80a1) are still unnamed and stay hex. The tail is
 *           the decompiled loc_287a.
 */

import { loc_287a } from "./loc_287a.js";
import { REACTION_OBJ_X, REACTION_OBJ_Y, REACTION_STATE, REACTION_TIMER } from "./ram.js";

export function loc_24cf(m) {
  const { mem8 } = m;

  // Reset the per-object reaction state machine to its rest state.
  mem8[REACTION_STATE] = 0; // idle — no reaction armed
  mem8[REACTION_TIMER] = 0; // reaction step timer cleared
  mem8[0x80a3] = 24; // reaction step period (the reload value)

  // Seed the companion control bytes to their fixed start values.
  mem8[0x80a1] = 1;
  mem8[REACTION_OBJ_X] = 0;
  mem8[0x8096] = 3;
  mem8[REACTION_OBJ_Y] = 0;
  mem8[0x809c] = 1;

  // Tail hand-off into loc_287a (dig-object control-block seed + round/level
  // parameter chain); its chain returns to our caller, so this is loc_24cf's exit.
  return loc_287a(m);
}
