// SPDX-License-Identifier: GPL-3.0-only
import { SAUCER_HIT } from "./names.js";
import { retirePlayerShot } from "./retirePlayerShot.js";

/**
 * markSaucerHitAndRetireShot — register a player shot striking the flying saucer.
 *
 * WHAT IT IS
 *   Raises the saucer-hit flag so the saucer switches into its explosion/score sequence, then retires
 *   the player shot that struck it.
 *
 * ROLE IN THE MACHINE
 *   Reached from the shot resolver resolvePlayerShotHit when a player shot collides in the saucer's
 *   altitude band (mechanisms.md, the player-shot collision teardown). SAUCER_HIT (0x2085) is read by
 *   updateSaucerSound (to cut the whine / play the hit tone) and by the saucer handler to run the
 *   destruction/score path. retirePlayerShot (0x1545) then stamps PLAYER_SHOT_STATUS to 4 (retiring)
 *   and clears the shot's hit latch and sound. This is one of two entries into that retirement (the
 *   other is the alien-explosion despawn).
 *
 * ROM 0x1579.  Grounding: [seen].
 *
 * LIVE-OUT: A (from retirePlayerShot's silence tail) plus SAUCER_HIT set.
 */
export function markSaucerHitAndRetireShot(m) {
  // Flag the saucer as hit -- the audio and the saucer handler read this to enter the death/score run.
  m.mem8[SAUCER_HIT] = 0x01;
  // Retire the player shot (status -> 4) and silence its sound; the seam completes the ret.
  return retirePlayerShot(m);
}
