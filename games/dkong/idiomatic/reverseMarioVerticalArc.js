// SPDX-License-Identifier: GPL-3.0-only
/**
 * reverseMarioVerticalArc — re-base Mario's vertical arc at the point he is standing on now,
 * unless the fall he is in has already been condemned as lethal.
 *
 * Reached only from the airborne handler's two playfield-limit arms: the horizontal position
 * gate has just reported that Mario is airborne at the left or right limit, and the arm that
 * got here has already stamped a fresh horizontal velocity pushing him back inside plus the
 * matching facing bit. What is left is the vertical half of the reflection, and that is this
 * routine.
 *
 * The ballistic integrator stores a vertical arc as a CONSTANT launch velocity plus a count
 * of frames elapsed, and each frame moves Mario down by (16·frames + 8 − velocity) — so the
 * velocity field alone is not the current speed, it is the speed the arc started with. To
 * change direction mid-arc the game therefore cannot just negate a field; it has to fold the
 * elapsed frames back into the velocity. That is what happens here: the new velocity becomes
 * 16·frames − velocity and the frame count restarts at zero, which re-bases the same parabola
 * at Mario's present position with its vertical step negated (plus the one gravity increment
 * the restarted counter re-applies).
 *
 * The arithmetic itself is a shared leaf, which spreads a packed byte into a fixed-point
 * value and subtracts the record's 16-bit field. For Mario's record the packed byte is the
 * plain airborne-frame counter, and that spread is exactly a ×16 scale for every byte value,
 * so the difference it hands back is precisely 16·frames − velocity.
 *
 * A fall already latched as lethal (MARIO_FATAL_FALL) is exempt: the re-basing is skipped
 * entirely, so a killing fall keeps its arc and lands, rather than being bounced back up by
 * the edge. Observed in a driven one-player game: with Mario held against the left edge, an
 * ordinary jump's stored velocity alternates between two values and his height oscillates
 * instead of descending, while the same run with the fatal-fall latch set leaves both the
 * velocity and the frame count untouched and he continues down.
 *
 * THE RECORD BASE. Both entries reach here with the object pointer set to Mario's block, and
 * nowhere else reaches this routine at all, so the three record fields written here ARE the
 * absolute cells MARIO_AIR_VY_HI, MARIO_AIR_VY_LO and MARIO_AIR_FRAMES, and are named as
 * such. The arithmetic leaf stays pointer-relative because its other callers work on
 * different records; it reads the same three bytes through the pointer the caller left set.
 *
 * The tail runs the ballistic step and the rest of the airborne cascade for this frame, on
 * both arms.
 *
 * LIVE-OUT: memory-only — the two velocity bytes and the frame count, plus everything the
 * shared tail writes; and the tail's own return value, forwarded, which the airborne
 * cascade's callers propagate.
 */

import {
  MARIO_FATAL_FALL,
  MARIO_AIR_VY_HI,
  MARIO_AIR_VY_LO,
  MARIO_AIR_FRAMES,
} from "./names.js";
import { loc_2407 } from "./loc_2407.js";
import { loc_1bec } from "./loc_1bec.js";

export function reverseMarioVerticalArc(m) {
  const { mem } = m;

  // A fall already condemned as lethal keeps its arc — no re-basing, straight to the tail.
  if (mem.read8(MARIO_FATAL_FALL) !== 1) {
    // 16·(airborne frames) − (stored launch velocity): the current vertical step, negated.
    const rebasedVelocity = loc_2407(m);
    mem.write8(MARIO_AIR_VY_HI, rebasedVelocity >> 8);
    mem.write8(MARIO_AIR_VY_LO, rebasedVelocity); // the store truncates to the low byte
    mem.write8(MARIO_AIR_FRAMES, 0); // restart the arc's frame count at the present point
  }

  // Shared tail: the ballistic step for this frame and the rest of the airborne cascade.
  // (The caller's record-pointer helper is not threaded down this tail. Nothing downstream
  // reads it — the tail only forwards it to the airborne handler, which ignores it.)
  return loc_1bec(m);
}
