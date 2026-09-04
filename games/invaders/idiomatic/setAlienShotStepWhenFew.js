// SPDX-License-Identifier: GPL-3.0-only
import { ALIEN_COUNT, ALIEN_SHOT_STEP } from "./names.js";

/**
 * setAlienShotStepWhenFew — speed up alien shots once the fleet is thin.
 *
 * WHAT IT IS
 *   When fewer than nine aliens remain, it stamps 0xfb into ALIEN_SHOT_STEP (0x207e), the per-frame vertical
 *   step the alien-shot stepper descends a shot by. When nine or more aliens are alive it does nothing,
 *   leaving whatever step was already in place.
 *
 * ROLE IN THE MACHINE
 *   Runs from the in-game main loop's "while aliens remain" services (mainLoop), which read ALIEN_COUNT
 *   (0x2082) — the live-alien tally countLiveAliens publishes each frame. ALIEN_SHOT_STEP is the alien shot's
 *   Y step: stepAlienShot advances a live shot's Y by the value in this cell (see mechanisms.md, "Alien
 *   shot rate and rendering"). Forcing it to 0xfb near the end of a wave changes how fast the surviving
 *   aliens' shots travel — part of how the game tightens as the fleet dwindles.
 *
 * ROM 0x08d8.  Grounding: [seen] (ALIEN_COUNT is [seen]).
 *
 * LIVE-OUT: memory only, and only on the taken branch (ALIEN_SHOT_STEP := 0xfb).
 */
export function setAlienShotStepWhenFew(m) {
  // Only when the live-alien count has dropped below nine: set the alien-shot Y step to 0xfb.
  if (m.mem8[ALIEN_COUNT] < 0x09) m.mem8[ALIEN_SHOT_STEP] = 0xfb;
}
