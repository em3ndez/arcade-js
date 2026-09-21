// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchDeathAnimationPhase — router for Mario's death-animation state machine in
 * DEATH_ANIM_PHASE: hand the frame to the handler for phase 0/1/2; any other value raises.
 *
 * LIVE-OUT: memory-only — the dispatched arm's RAM writes.
 */
import { DEATH_ANIM_PHASE } from "./names.js";
import { NotImplemented } from "../../../boards/dkong/io.js";
import { beginMarioDeathAnimation } from "./beginMarioDeathAnimation.js";
import { stepMarioDeathAnimation } from "./stepMarioDeathAnimation.js";
import { loc_12de } from "./loc_12de.js";

const HANDLERS = [
  beginMarioDeathAnimation, // phase 0 — seed the animation, prime the tick counter, advance the phase
  stepMarioDeathAnimation, // phase 1 — rotate the sprite each gate tick, advance the phase at expiry
  loc_12de, // phase 2 — on timer expiry, advance the game sub-state and re-arm the gate
];

export function dispatchDeathAnimationPhase(m) {
  const handler = HANDLERS[m.mem8[DEATH_ANIM_PHASE]];
  if (handler) return handler(m);

  throw new NotImplemented(
    `dispatchDeathAnimationPhase: DEATH_ANIM_PHASE ${m.mem8[DEATH_ANIM_PHASE]} has no handler (phases above 2 do not occur).`,
  );
}
