// SPDX-License-Identifier: GPL-3.0-only
/**
 * endClimbAtLadderLimit — finish a ladder climb that has reached a ladder end.
 *
 * Runs on the frame the climb stepper finds Mario at either extent of the ladder he is on: he has
 * climbed onto the girder at the top, or stepped off at the bottom. The dismount is three fixed
 * stores followed by a sprite refresh, and reads nothing at all:
 *   - MARIO_SPRITE_CODE gets the ladder-end pose, written FLAT — the facing/mirror bit is
 *     deliberately dropped, because at a ladder end Mario faces front.
 *   - the climb half-step toggle is cleared.
 *   - MARIO_ON_LADDER is cleared, so the next frame's input handling no longer takes the climb
 *     branch. That one bit is what distinguishes a dismount from a climb that continues.
 * Then the shared sprite refresh copies Mario's live X, code, attribute and Y into his hardware
 * sprite record, which is how the pose just stored reaches the screen.
 *
 * LIVE-OUT: memory-only — the three bytes above plus the four sprite-record bytes.
 */

import { MARIO_SPRITE_CODE, MARIO_ON_LADDER } from "./names.js";
import { writeMarioSpriteRecord } from "./writeMarioSpriteRecord.js";

/** Climb half-step toggle scratch, cleared on a ladder-end dismount. */
const CLIMB_TOGGLE = 0x6219;

/** Sprite code for Mario at a ladder end (written flat, discarding the facing bit). */
const LADDER_END_POSE = 0x06;

export function endClimbAtLadderLimit(m) {
  const { mem } = m;
  mem.write8(MARIO_SPRITE_CODE, LADDER_END_POSE); // the ladder-end pose
  mem.write8(CLIMB_TOGGLE, 0x00);                 // clear the climb half-step toggle
  mem.write8(MARIO_ON_LADDER, 0x00);              // off the ladder now
  writeMarioSpriteRecord(m);                      // refresh the hardware sprite record
}
