// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceActorWalk — carry an actor's walk forward one frame: advance its position,
 * pick the walk frame, then commit + record it.  ROM 0x19d0.
 *
 * The "keep moving" default arm of the actor-movement dispatch, reached when nothing
 * under the actor needs a reaction. It walks the actor one frame: the position
 * accumulator is carried forward by the actor's per-frame step, and the walk sprite is
 * chosen off bit 1 of the new position — the base frame, or the same frame mirrored —
 * so the sprite flips back and forth every two units of travel.
 *
 * It hands that frame to drawActorWalkFrame, which commits it, fires the goal crossing's
 * far-edge one-shot once the actor has walked out to the edge, and builds the object's
 * display record. That record builder's return unwinds to this routine's caller, so this
 * routine leaves no live register.
 *
 * Sibling to walkActor: that stepper carries the other coordinate with an eight-step walk
 * cycle; this one carries the PLAYER_X accumulator and simply toggles the mirror every two
 * units.
 *
 * Memory-equivalent to the frozen oracle — equivalence-19d0.test.js.
 * GATE:     strict — reads only work RAM. Validated on real captured attract dispatches
 *           (advanceActorWalk runs in the movement continuation reached from the dig classifier)
 *           plus a crafted sweep of the position accumulator over all 256 new values,
 *           covering both walk frames and the accumulator's byte wrap.
 * LIVE-OUT: memory-only — the advanced position accumulator (PLAYER_X), plus everything
 *           drawActorWalkFrame writes (the committed walk frame, the far-edge
 *           timer/coordinate pair, the display record). The registers the oracle leaves
 *           behind are dead ABI no caller reads.
 * NAMES:    PLAYER_X from names.js. The per-frame step is PLAYER_STEP_X (0x806d) — the PLAYER_X
 *           step, distinct from walkActor's PLAYER_STEP_Y (0x806c).
 */

import { PLAYER_X } from "./names.js";
import { drawActorWalkFrame } from "./drawActorWalkFrame.js";

const STEP = 0x806d; // per-frame amount carried onto the PLAYER_X position accumulator

export function advanceActorWalk(m) {
  const { mem8 } = m;

  // Carry the actor forward by its per-frame step. The store keeps only the low byte,
  // so the position accumulator wraps.
  mem8[PLAYER_X] = mem8[PLAYER_X] + mem8[STEP];

  // Pick the walk frame off bit 1 of the new position: the base frame, or the same frame
  // mirrored, so the sprite flips every two units of travel.
  const walkFrame = mem8[PLAYER_X] & 2 ? 0xb4 : 0x34;

  // Commit the frame, fire the crossing far-edge one-shot, and build the display record;
  // that builder's return unwinds to our caller (the oracle reaches it by a tail-jump).
  return drawActorWalkFrame(m, walkFrame);
}
