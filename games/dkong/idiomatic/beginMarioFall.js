// SPDX-License-Identifier: GPL-3.0-only
/**
 * beginMarioFall — when the "ground went away" trigger is armed, drop Mario into a fresh
 * falling state and remember the height he fell from.
 *
 * Called once per pass from the shared per-frame update cascade. It does nothing at all
 * unless the start-fall trigger is set — the slope/ledge contact check raises that
 * trigger the moment it finds no girder under Mario's foot. On the frame the trigger is
 * found set, this routine consumes it and rebuilds Mario's motion state for a fall that
 * starts from rest:
 *
 *   - clears the fractional X/Y sub-pixel remainders and the entire airborne
 *     velocity + elapsed-frame state, so the fall begins with zero speed;
 *   - marks Mario airborne, which is the state the movement machine reads next frame to
 *     hand him to the airborne handler;
 *   - arms the fall-height/landing check immediately, so the drop is evaluated from the
 *     very next airborne frame rather than waiting for a jump to near its apex;
 *   - snapshots his current height as the take-off Y — the value the landing code later
 *     measures the fall depth against to decide whether the fall is fatal.
 *
 * The trigger is a one-shot: it is cleared here as part of the reset. Its specific value
 * does not matter — any nonzero value launches the same fall, and zero means there is
 * nothing to do this frame.
 *
 * A LEAF: reads the trigger and Mario's height, writes the motion-state cells; calls
 * nothing and returns nothing.
 *
 * Only two values decide everything it does: the trigger, which selects the path, and
 * Mario's height, which is the one input the reset copies out. Every other cell it touches
 * takes a fixed constant — eight cleared to 0, two set to 1.
 *
 * LIVE-OUT: memory-only.
 */

import {
  MARIO_START_FALL,
  MARIO_X_FRAC,
  MARIO_Y_FRAC,
  MARIO_AIR_VX_HI,
  MARIO_AIR_VX_LO,
  MARIO_AIR_VY_HI,
  MARIO_AIR_VY_LO,
  MARIO_AIR_FRAMES,
  MARIO_AIRBORNE,
  MARIO_AIR_LANDCHECK,
  MARIO_Y,
  MARIO_AIR_START_Y,
} from "./names.js";

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {void}
 */
export function beginMarioFall(m) {
  const { mem } = m;

  // Nothing to do unless the slope/ledge check armed a fall this frame.
  if (mem.read8(MARIO_START_FALL) === 0) return;

  // Start the fall from rest: clear the sub-pixel position remainders and the whole
  // airborne velocity + elapsed-frame state, and consume the one-shot trigger.
  mem.write8(MARIO_X_FRAC, 0);
  mem.write8(MARIO_Y_FRAC, 0);
  mem.write8(MARIO_START_FALL, 0);
  mem.write8(MARIO_AIR_VX_HI, 0);
  mem.write8(MARIO_AIR_VX_LO, 0);
  mem.write8(MARIO_AIR_VY_HI, 0);
  mem.write8(MARIO_AIR_VY_LO, 0);
  mem.write8(MARIO_AIR_FRAMES, 0);

  // Put Mario airborne and arm the fall-height/landing check now, so the airborne
  // handler evaluates the drop from the next frame on.
  mem.write8(MARIO_AIRBORNE, 1);
  mem.write8(MARIO_AIR_LANDCHECK, 1);

  // Record the height he left the ground at; the landing code measures the fall
  // depth against this to decide whether it kills him.
  mem.write8(MARIO_AIR_START_Y, mem.read8(MARIO_Y));
}
