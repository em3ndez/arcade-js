// SPDX-License-Identifier: GPL-3.0-only
import { PLAYER_SHOT_STATUS } from "./names.js";
import { clearShotHitAndSilence } from "./clearShotHitAndSilence.js";

/**
 * retirePlayerShot -- put the player shot into its "retiring" state and silence the invader-die tone.
 *
 * WHAT IT IS
 *   The shared teardown step for a player shot that has finished its job (it struck the saucer band, or an
 *   alien explosion it started has run its course). It flips the shot's state cell to 4 (retiring) so the
 *   shot handler stops flying it, and it turns off the hit sound.
 *
 * ROLE IN THE MACHINE
 *   Writes PLAYER_SHOT_STATUS (0x2025) = 4, then tail-calls clearShotHitAndSilence, which clears the
 *   PLAYER_SHOT_HIT collision latch (0x2002) and masks bit 3 out of SOUND_PORT3_SHADOW (killing the
 *   invader-die tone). State 4 is the shot handler's post-flight state: on its next pass playerShotHandler
 *   routes state 4 into the shared tally that reseeds the shot record from its ROM template. Reached from
 *   markSaucerHitAndRetireShot (jmp 0x1545 -- a shot that struck the saucer's altitude band) and from
 *   tickAlienExplosionDespawn (the alien-explosion sprite's timed disappearance).
 *
 * ROM 0x1545-0x1549 (falling into clearShotHitAndSilence at 0x154a).  Grounding: [seen].
 *
 * LIVE-OUT: A = the mirrored port-3 shadow byte returned by clearShotHitAndSilence.
 */
export function retirePlayerShot(m) {
  // Stamp the retiring state, then hand off to the silence tail (clear the hit latch + mask the die tone off).
  m.mem8[PLAYER_SHOT_STATUS] = 0x04;
  return clearShotHitAndSilence(m);
}
