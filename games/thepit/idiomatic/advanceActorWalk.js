// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceActorWalk — carry an actor's walk forward one frame: advance its position, pick the
 * walk frame, then commit and record it. The "keep moving" default arm of the actor-movement
 * dispatch, reached when nothing under the actor needs a reaction. The position accumulator
 * (PLAYER_X) is carried forward by the per-frame step; the walk sprite is chosen off bit 1 of the
 * new position (base or mirrored, flipping every two units), then handed to drawActorWalkFrame, which commits and records it.
 */

import { PLAYER_X } from "./names.js";
import { drawActorWalkFrame } from "./drawActorWalkFrame.js";

const STEP = 0x806d;

export function advanceActorWalk(m) {
  const { mem8 } = m;

  // Carry the actor forward by its per-frame step; the store keeps only the low byte, so it wraps.
  mem8[PLAYER_X] = mem8[PLAYER_X] + mem8[STEP];

  // Pick the walk frame off bit 1 of the new position: base or mirrored, flipping every two units.
  const walkFrame = mem8[PLAYER_X] & 2 ? 0xb4 : 0x34;

  // Commit the frame, fire the crossing far-edge one-shot, and build the display record; its return is ours.
  return drawActorWalkFrame(m, walkFrame);
}
