// SPDX-License-Identifier: GPL-3.0-only
/**
 * walkActor — advance an actor's walk: accumulate its position, pick the walk frame, then build
 * its display record.
 *
 * A per-frame walk stepper, sibling to advanceObjectWalkFrame. Where that one re-measures against
 * a moving reference, this one carries the position PLAYER_Y forward by a per-frame step (a
 * velocity), driving an actor that walks under its own momentum. It reads a sub-tile phase off the
 * new position, then alternates the sprite PLAYER_FACING between two adjacent walk frames as that
 * phase advances, and hands the actor block to stageObjectSpriteRecord, which writes the 4-byte
 * record and returns straight to this routine's caller.
 */

import { PLAYER_Y, PLAYER_FACING, OBJECT_MOTION_MODE } from "./names.js";
import { stageObjectSpriteRecord } from "./stageObjectSpriteRecord.js";

const STEP = 0x806c;

export function walkActor(m) {
  const { mem8 } = m;

  mem8[PLAYER_Y] = mem8[PLAYER_Y] + mem8[STEP];

  // Walk phase: low three bits of the new position, biased by 3 to time the flip.
  const phase = (mem8[PLAYER_Y] + 3) % 8;
  mem8[OBJECT_MOTION_MODE] = phase;

  // Two-frame walk: even sprite through the first half, its odd neighbour once phase bit 1 sets.
  mem8[PLAYER_FACING] = phase & 2 ? 0x33 : 0x32;

  return stageObjectSpriteRecord(m);
}
