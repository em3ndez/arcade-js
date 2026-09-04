// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { countStepsToThreshold } from "./countStepsToThreshold.js";
import { loc_200a } from "./names.js";

/**
 * scaleYToBlock (ROM 0x156f) -- map a screen Y coordinate onto the coarse fleet grid.
 *
 * WHAT IT IS
 *   The inverse of the alien-placement mapping, for the vertical axis: given a Y coordinate in H, it counts
 *   how many 0x10-pixel grid steps separate the fleet's reference-Y base (loc_200a) from that coordinate,
 *   yielding a grid-row index. Its sibling scaleXToBlock (0x1562) does the same on the horizontal axis with
 *   loc_2009. Because aliens are placed at the reference corner plus 16 pixels per grid step, stepping the
 *   base up by 0x10 until it reaches the coordinate recovers which grid row the point falls in.
 *
 * ROLE IN THE MACHINE
 *   Used by the alien-shot launcher (stepAlienShot) to turn a Y source into a firing-column selector: the
 *   returned step count C is read to pick which column an alien shoots from. loc_200a is the reference-alien
 *   Y anchor (shared with alienIndexToScreenCoords). Delegates the counting to countStepsToThreshold, which
 *   normalizes a negative start up first and exits with carry deliberately cleared.
 *
 * ROM 0x156f.  Grounding: [seen] (names.js cert for 0x156f). Note loc_200a's exact axis role is a [guess]
 *   (mechanisms.md flags whether the X/Y labels here are literal as not yet pinned down).
 *
 * LIVE-OUT: A and H both hold the leftover residual (start value minus the last overshoot step); C holds
 *   the grid-step count (the block index).
 */
// Scale the object's Y cell toward the threshold in H; return [A, H, C]: the leftover residual in A and H,
// and the step count C (which callers read to pick a firing column).
export function scaleYToBlock(m, h = m.regs.h) {
  // Count 0x10-steps from the reference-Y base (loc_200a) up to the coordinate H; stepped = final value, count = steps.
  const [stepped, count] = countStepsToThreshold(m, m.mem8[loc_200a], h);
  // Back off the last full step to leave the sub-step remainder (matches the 8080 `sui 0x10` after the count loop).
  const residual = u8(stepped - 0x10);
  // Publish the residual to both A and H, and hand back the step count as the block index.
  return [(m.regs.a = residual), (m.regs.h = residual), count];
}
