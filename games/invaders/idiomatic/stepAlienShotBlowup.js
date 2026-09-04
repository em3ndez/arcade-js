// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { ALIEN_SHOT_BLOWUP_TIMER, ALIEN_SHOT_SPRITE_PTR, ALIEN_SHOT_BLOWUP_SPRITE, loc_207b, loc_207c, ALIEN_SHOT_ROW_COUNT } from "./names.js";
import { eraseAlienShot } from "./eraseAlienShot.js";
import { drawAlienShotWithCollision } from "./drawAlienShotWithCollision.js";

/**
 * stepAlienShotBlowup -- run the terminal explosion ("blowup") animation of a spent alien shot.
 *
 * WHAT IT IS
 *   When an alien shot ends (it struck the ground, a shield, or the player) it does not vanish instantly --
 *   it plays a short burst. This routine ticks the shot's blowup countdown once per call and drives the two
 *   visible moments of that burst off it: swap in the explosion graphic, then, later, erase it.
 *
 * ROLE IN THE MACHINE
 *   Reached from the alien-shot stepper stepAlienShot (ROM 0x05cc) while the shot's blowup bit is set.
 *   Decrements ALIEN_SHOT_BLOWUP_TIMER (0x2078). At exactly 3 it erases the current shot sprite, repoints
 *   the shot descriptor ALIEN_SHOT_SPRITE_PTR (0x2079) at the blowup graphic ALIEN_SHOT_BLOWUP_SPRITE
 *   (0x1cdc), nudges the shot's two coordinate bytes (loc_207b/loc_207c) back two pixels each to recenter
 *   the wider burst, forces its height ALIEN_SHOT_ROW_COUNT (0x207d) to six rows, and redraws it with
 *   collision. At 0 it just erases the burst (the shot despawns). Any other value idles this frame.
 *
 * ROM 0x0644-0x0669.  Grounding: [seen].
 *
 * LIVE-OUT: memory only; the two tails (drawAlienShotWithCollision / eraseAlienShot) leave HL/DE/A per
 * their own contracts. The stepper caller ignores the result.
 */
export function stepAlienShotBlowup(m) {
  // Tick the blowup countdown by one and store it back (the mem8 write truncates to a byte).
  const next = u8(m.mem8[ALIEN_SHOT_BLOWUP_TIMER] - 1);
  m.mem8[ALIEN_SHOT_BLOWUP_TIMER] = next;
  // Off the spawn point (3): at 0 the burst has run its course, so erase it (the shot despawns); at any
  // other value there is nothing to do this frame.
  if (next !== 0x03) {
    if (next !== 0) return;
    return eraseAlienShot(m);
  }
  // Countdown just reached 3 -> begin the burst. Erase the shot sprite first so its bits do not linger.
  eraseAlienShot(m);
  // Swap the descriptor over to the explosion graphic.
  m.mem16[ALIEN_SHOT_SPRITE_PTR] = ALIEN_SHOT_BLOWUP_SPRITE;
  // Recenter for the wider burst: pull both coordinate bytes back two pixels.
  m.mem8[loc_207c] = m.mem8[loc_207c] - 2;
  m.mem8[loc_207b] = m.mem8[loc_207b] - 2;
  // Force the burst's height to six rows, then draw it (with collision so it can still register a hit).
  m.mem8[ALIEN_SHOT_ROW_COUNT] = 0x06;
  return drawAlienShotWithCollision(m);
}
