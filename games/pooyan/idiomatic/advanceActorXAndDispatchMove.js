// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { dispatchActorPhaseGatedByDelay } from "./dispatchActorPhaseGatedByDelay.js";
import { finishActorOrArmTurnaround } from "./finishActorOrArmTurnaround.js";
import { STAGE_COUNTDOWN } from "./names.js";
/**
 * advanceActorXAndDispatchMove — advance an actor's X, then dispatch on the stage countdown.
 *
 * WHAT IT IS
 *   The per-frame horizontal-motion step for one moving actor. Every actor record carries a
 *   signed velocity byte; this routine applies that velocity to the actor's screen X, keeps the
 *   record's coarse column/lap counter in step when the low X byte wraps, and then hands the
 *   record on to whichever mover is appropriate for how far the stage has progressed.
 *
 * ROLE IN THE MACHINE
 *   This is the common "move me one frame" body shared by the enemy/object movers. It does the
 *   arithmetic on the position and immediately tails into a phase handler — it never renders and
 *   never decides *whether* to move, only advances position and routes. The stage countdown
 *   (0x8901) it reads is the coarse timer that runs a stage down from 0x20 toward 0: while the
 *   stage is young the actor takes the plain end-of-move path; once the stage is nearly over it
 *   is instead driven by its own phase-state AI. So the same actor's behaviour tightens as the
 *   stage ages, all keyed off this single dispatch.
 *
 * ROM: 0x3757-0x3774.
 *
 * Grounding: [seen]
 *
 * LIVE-OUT: none — control tails into a dispatched state handler; the record's X (rec+0x05) and,
 *   on a low-byte wrap, its column/lap counter (rec+0x06) are the only cells this body writes.
 *   The chosen handler is entered with the freshly computed X carried in B.
 */
// Actor-record field offsets (the record base is passed in `rec`, defaulting to IX):
const REC_X = 0x05; // low byte of the actor's screen X position
const REC_LAP_COUNTER = 0x06; // coarse column/lap counter — the high half of the position, borrowed into on an X wrap
const REC_STEP = 0x0a; // signed per-frame velocity added to X (negative = moving toward lower X)
const AI_GATE = 0x03; // stage-countdown value below which AI hands off to the phase dispatch

export function advanceActorXAndDispatchMove(m, rec = m.regs.ix) {
  const { mem8 } = m;
  // Read this actor's signed velocity (rec+0x0a) and its current X (rec+0x05). The step is a
  // two's-complement byte: a negative value moves the actor toward the left edge of the screen.
  const step = mem8[rec + REC_STEP];
  const x = mem8[rec + REC_X];
  // Borrow detection for the low X byte. `u8(-step)` is the two's-complement magnitude of the
  // step; when X is below it, the pending add will carry X down past zero (a left-moving actor
  // wrapping under the low edge). Treat (rec+0x06 : rec+0x05) as a coarse position whose high
  // half is the column/lap counter, and decrement that high half to carry the borrow — done
  // BEFORE the add so the counter reflects the wrap the add is about to produce.
  if (x < u8(-step)) mem8[rec + REC_LAP_COUNTER] = mem8[rec + REC_LAP_COUNTER] - 1;
  // Apply the velocity to X, wrapping to a byte, and store the new position back into the record.
  const newX = u8(x + step);
  mem8[rec + REC_X] = newX;
  // Route on how far the stage has run. STAGE_COUNTDOWN (0x8901) counts a stage down from 0x20;
  // once it drops below 3 the stage is in its final beats, so the actor is handed to its own
  // phase-state AI (dispatchActorPhaseGatedByDelay), entered with the new X carried in B. For the
  // rest of the stage it takes the plain end-of-move path (finishActorOrArmTurnaround), which
  // finish-blanks the sprite band in the terminal phase or otherwise arms a turn-around anim.
  if (mem8[STAGE_COUNTDOWN] < AI_GATE) return dispatchActorPhaseGatedByDelay(m, rec, newX); // new X in B
  return finishActorOrArmTurnaround(m, rec);
}
