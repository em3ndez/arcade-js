// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawActorWalkFrame — commit the actor's animation frame, then fire the crossing far-edge one-shot.
 *
 * The tail of the actor-movement "keep moving" continuation: the predecessor advanced the
 * actor and picked its walk frame; this commits that frame into the sprite-code cell. Then
 * a far-edge one-shot fires only during the post-goal crossing — when the crossing latch is
 * set and the actor has reached the far edge, it arms the state-lockout timer and clears the
 * object's leading coordinate. Every path rebuilds the object's record, whose return unwinds here.
 */

import { PLAYER_FACING, PIT_CROSS_ACTIVE, PLAYER_X, TRANSITION_TIMER, PLAYER_Y } from "./names.js";
import { stageObjectSpriteRecord } from "./stageObjectSpriteRecord.js";

// The row the actor must reach before the crossing's far-edge one-shot fires.
const CROSSING_FAR_EDGE = 138;
// Duration armed into the state-lockout timer when the actor completes the crossing.
const CROSSING_LOCKOUT = 180;

export function drawActorWalkFrame(m, spriteCode = m.regs.a) {
  const { mem8 } = m;

  // Commit the actor's chosen animation frame.
  mem8[PLAYER_FACING] = spriteCode;

  // Far-edge one-shot: only while a crossing is active and the actor is at the far edge.
  if (mem8[PIT_CROSS_ACTIVE] !== 0 && mem8[PLAYER_X] >= CROSSING_FAR_EDGE) {
    mem8[TRANSITION_TIMER] = CROSSING_LOCKOUT;
    mem8[PLAYER_Y] = 0;
  }

  // Rebuild the object's display/deferral record; its return unwinds to our caller.
  stageObjectSpriteRecord(m);
}
