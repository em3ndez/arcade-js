// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { DROP_ANIM_DESCRIPTOR } from "./names.js";

/**
 * advanceRisingActorThenSettleOrArmDrop — one-frame state handler for a rising on-screen
 * object. [seen]  (ROM 0x1496)
 *
 * WHAT IT IS
 * ----------
 * A per-object worker for the moving-actor system. Each moving thing on screen is tracked by
 * an OBJECT RECORD — a fixed-layout block of bytes in work RAM whose base address arrives as
 * `rec`. Every frame the object's owning state gives the record one tick of attention by
 * calling the handler for its current state; this is the handler for the "rising" state.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * A rising object climbs the screen a little each frame and, when it has climbed far enough,
 * changes what it does next. This routine performs one frame of that climb in two acts:
 *   1. ANIMATE + MOVE — step the object's picture one frame, then walk its 8-bit position
 *      field by a fixed signed step, counting down a LAP COUNTER every time that walk wraps
 *      the position byte past zero (i.e. once per completed sweep of the field).
 *   2. RE-ARM — once the lap counter has run low, retire the rising state. Which retirement
 *      it takes is decided by the record's ACTIVE flag:
 *        - an ACTIVE object with a low lap count settles: it clears its sub-state and drops
 *          back to the idle picture.
 *        - an INACTIVE object with a very low lap count instead arms a DROP: it points itself
 *          at the drop animation sequence and sets the drop sub-state.
 *      Any frame whose lap count has not yet fallen far enough simply falls through, leaving
 *      the record in the rising state for another frame.
 *
 * The two thresholds differ on purpose (active settles at lap < 4, inactive arms the drop at
 * lap < 2), so the active object peels off one full lap earlier than the inactive one.
 *
 * LIVE-OUT: memory only — the object record. Nothing is returned to the caller: the dispatch
 * loop that reaches this handler ignores any register value, so the whole result is the
 * mutated record (position, lap counter, sub-state, anim field, and — on the drop path — the
 * animation-sequence pointer installed by setActorAnimation).
 */

// Byte offsets into the object record, all measured from its base address `rec`.
const REC_SUBSTATE = 0x02; // sub-state selector within the object's current top-level state
const REC_POS = 0x03; //      8-bit position field, walked one step per frame
const REC_LAP = 0x04; //      lap counter: sweeps of the position field still to run
const REC_ACTIVE = 0x07; //   active flag: non-zero picks the "settle" retirement, zero the "drop"
const REC_STEP = 0x0a; //     signed per-frame step added to the position field each tick
const REC_ANIM = 0x11; //     anim-selector byte set when the object changes look

const ANIM_IDLE = 0x20; // idle picture selector, written when an active object settles
const ANIM_DROP = 0x28; // drop picture selector, written when an inactive object arms its drop
const SUBSTATE_DROP = 0x02; // sub-state value marking "dropping" once the drop is armed

export function advanceRisingActorThenSettleOrArmDrop(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // ACT 1a — advance the object's animation by one frame. The shared animation sequencer
  // counts down this record's frame-hold and, on expiry, walks its animation script to the
  // next {tile, attribute, hold}. The rising object keeps flipping through its climb picture
  // regardless of what the position math below decides.
  advanceObjectAnimationFrame(m, rec);

  // ACT 1b — walk the position field by the signed per-frame step at rec+0x0a.
  //
  // The step is a signed value; a rising object carries a negative step, so adding it drives
  // the 8-bit position field (rec+0x03) downward and eventually wraps it past zero. The
  // compare below detects exactly that wrap BEFORE it happens: (0 - step) & 0xff is the
  // step's magnitude, and when the current position is smaller than that magnitude the add is
  // about to carry the byte past zero — one completed sweep of the field. On that frame the
  // LAP COUNTER at rec+0x04 is decremented first, so the counter tallies how many full sweeps
  // remain.
  const step = mem8[rec + REC_STEP];
  if (mem8[rec + REC_POS] < ((0 - step) & 0xff)) mem8[rec + REC_LAP] -= 1; // ran past the step
  mem8[rec + REC_POS] += step; // integrate one frame of motion (8-bit wrap is intended)

  // ACT 2 — re-arm on the (possibly just-decremented) lap counter, branched by the active flag.
  const lap = mem8[rec + REC_LAP];
  if (mem8[rec + REC_ACTIVE] !== 0) {
    // ACTIVE object: settle one lap early. Once fewer than four sweeps remain, leave the
    // rising state by zeroing the sub-state selector (rec+0x02) and pointing the anim-selector
    // (rec+0x11) at the idle picture. Above that threshold the frame falls through unchanged.
    if (lap < 4) {
      mem8[rec + REC_SUBSTATE] = 0x00; // back to sub-state 0
      mem8[rec + REC_ANIM] = ANIM_IDLE; // show the idle picture
    }
  } else if (lap < 2) {
    // INACTIVE object: arm the drop. Once fewer than two sweeps remain, retarget the record's
    // animation at the drop sequence (descriptor 0x3bd1) via setActorAnimation — which
    // installs the sequence pointer and restarts it at frame 0 — then mark the record as
    // dropping by writing the drop sub-state (rec+0x02) and the drop anim-selector (rec+0x11).
    setActorAnimation(m, rec, DROP_ANIM_DESCRIPTOR);
    mem8[rec + REC_SUBSTATE] = SUBSTATE_DROP; // enter the dropping sub-state
    mem8[rec + REC_ANIM] = ANIM_DROP; // show the drop picture
  }
}
