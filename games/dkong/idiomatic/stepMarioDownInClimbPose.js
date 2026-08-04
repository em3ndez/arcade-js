// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepMarioDownInClimbPose — step Mario down one pixel, held in the climb-down pose.
 *
 * The Y-descend tail of the conveyor-board object's descend arm: when that arm finds Mario's
 * screen Y still numerically above the centring line — that is, still HIGHER on screen, since
 * larger Y is lower — or on an odd row, it lands here. There are two ways in, one by
 * fall-through and one by jump, and both target this routine's first instruction. Each call
 * nudges Mario down one pixel in two places and pins his drawn pose:
 *
 *   - Increment his logical screen position, so the game-side Mario drops one pixel.
 *   - Pin his hardware sprite to a fixed climb frame and take back a pointer to that sprite
 *     record's Y field.
 *   - Increment that sprite-record Y, so the drawn sprite drops one pixel to match.
 *
 * So the logical position and the on-screen sprite both descend one pixel per call, and the
 * sprite is held in the climb-down pose while they do. Both asserted facts rest on named cells:
 * the direction is DOWN because larger Y is lower on this screen, and the pose is a CLIMB pose
 * because the pose codes 3 through 5 are the climb frames and the pin forces the first of them
 * with the mirror flag clear.
 *
 * Reads: Mario's logical Y and his sprite-record Y. Writes: both of them, and — through the
 * pose pin — his sprite-code byte.
 *
 * LIVE-OUT: memory-only.
 */

import { MARIO_Y } from "./names.js";
import { pinMarioClimbPose } from "./pinMarioClimbPose.js";

export function stepMarioDownInClimbPose(m) {
  const { mem } = m;

  // Move Mario's logical screen position down one pixel.
  mem.write8(MARIO_Y, mem.read8(MARIO_Y) + 1);

  // Pin the hardware sprite to the climb-down pose and take a pointer to its Y field...
  const spriteYPtr = pinMarioClimbPose(m);

  // ...then move the drawn sprite down one pixel to match.
  mem.write8(spriteYPtr, mem.read8(spriteYPtr) + 1);
}
