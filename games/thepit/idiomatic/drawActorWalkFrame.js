// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawActorWalkFrame — commit the actor's animation frame, then fire the crossing's far-edge one-shot.  ROM 0x19e3.
 *
 * The tail of the actor-movement "keep moving" continuation (advanceActorWalk): the predecessor has
 * just advanced the actor and picked its walk-animation frame, and hands that frame in. This
 * routine commits the frame into the actor's sprite-code cell.
 *
 * Then a single far-edge one-shot, fired only during the post-goal crossing sequence: when the
 * goal-crossing latch is set AND the actor has walked out to the crossing's far edge (its row
 * accumulator has reached the far-edge limit), it arms the object's state-lockout timer and
 * clears the object's leading coordinate — resetting it once the crossing walk completes. An
 * actor that is not crossing, or one still short of the edge, does neither and leaves those two
 * cells untouched.
 *
 * Every path ends by rebuilding the object's display/deferral record (stageObjectSpriteRecord); that rebuild's
 * own return unwinds to this routine's caller, so the routine produces no live register.
 *
 * Memory-equivalent to the frozen oracle — equivalence-19e3.test.js.
 * GATE:     crafted-entry — 0x19e3 is only ever reached inline as the tail of advanceActorWalk (never
 *           dispatched on its own), so entries are cloned from real captured advanceActorWalk attract
 *           dispatches. The far-edge latch is never taken in attract (the goal-crossing latch is
 *           always clear there), so all three branches are forced identically on both arms. Its
 *           inputs are the incoming frame plus a handful of work-RAM bytes, so any real state is
 *           a valid entry.
 * LIVE-OUT: memory-only — the committed sprite frame, the armed state timer and cleared leading
 *           coordinate on the far-edge path, and the record stageObjectSpriteRecord rebuilds. The registers/flags
 *           the oracle leaves behind (from its tail into stageObjectSpriteRecord) are dead ABI no caller reads.
 * NAMES:    SPRITE_CODE, GOAL_CROSSING_LATCH, OBJ_Y, STATE_TIMER, OBJ_X from ram.js.
 */

import { SPRITE_CODE, GOAL_CROSSING_LATCH, OBJ_Y, STATE_TIMER, OBJ_X } from "./ram.js";
import { stageObjectSpriteRecord } from "./stageObjectSpriteRecord.js";

// The row the actor must reach before the crossing's far-edge one-shot fires.
const CROSSING_FAR_EDGE = 138;
// Duration armed into the state-lockout timer when the actor completes the crossing.
const CROSSING_LOCKOUT = 180;

export function drawActorWalkFrame(m, spriteCode = m.regs.a) {
  const { mem8 } = m;

  // Commit the actor's chosen animation frame.
  mem8[SPRITE_CODE] = spriteCode;

  // Far-edge one-shot: only while a goal crossing is active and the actor has walked out
  // to the far edge. Arm the state-lockout timer and reset the object's leading coordinate.
  if (mem8[GOAL_CROSSING_LATCH] !== 0 && mem8[OBJ_Y] >= CROSSING_FAR_EDGE) {
    mem8[STATE_TIMER] = CROSSING_LOCKOUT;
    mem8[OBJ_X] = 0;
  }

  // Rebuild the object's display/deferral record; its return unwinds to our caller.
  stageObjectSpriteRecord(m);
}
