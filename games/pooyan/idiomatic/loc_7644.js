// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { SHARED_PHASE_COUNTDOWN } from "./names.js";

// Byte offsets and constants for one enemy-actor record and the pool-wide reseed.
const STATE_FIELD = 0x02; //  dispatch-state byte: its low bits pick this record's tick handler (0/1/2)
const FRAME_FLOOR = 0x06; //  the animation cycle is still mid-run while the frame counter (+0x06) is >= this
const RESET_TIMER = 0x20; //  value armed into the shared phase countdown when the cycle completes
const RESET_COUNT = 0x0e; //  number of consecutive records forced into the next phase on completion (14)
const RESET_STRIDE = 0x18; //  spacing between records in the enemy-actor pool
const STATE_ACTIVE = 0x01; //  dispatch-state value written into each reseeded record (selects state 1, the countdown handler)

/**
 * loc_7644 — animation-tick state 0: step one enemy record's animation cadence, and once its
 * cycle completes reseed the whole enemy pool into the next phase. [seen] (ROM 0x7644–0x7674)
 *
 * WHAT IT IS
 * Every enemy the game tracks is an ACTOR RECORD — a fixed-layout block of bytes in the enemy
 * pool (records spaced RESET_STRIDE=0x18 apart), whose base address arrives in the record
 * pointer (ix). One byte, the DISPATCH-STATE field at +0x02, says which tick behaviour the
 * record is currently running; the low bits of that byte select one of three per-record tick
 * handlers (states 0/1/2). This routine is the STATE 0 handler.
 *
 * ITS ROLE IN THE MACHINE
 * State 0 runs the record's animation cadence and watches for the end of its cycle. Each frame
 * it advances a fixed-point animation-progress accumulator: the per-frame step at +0x09 is
 * subtracted from the sub-position at +0x05, and every time that subtraction borrows (underflows
 * past zero) the frame counter at +0x06 is ticked down by one. While that frame counter is still
 * at or above FRAME_FLOOR (6) the cycle is mid-run and the record simply keeps animating. When it
 * finally drops below 6 the animation cycle has completed, and this handler performs the pool-wide
 * PHASE TRANSITION: it arms the shared phase countdown and forces the next RESET_COUNT (14)
 * records — this one and the 13 following it — out of state 0 and into state 1 (the countdown
 * handler, which will drain the shared timer and then advance the pool again).
 *
 * The record's animation frames themselves are stepped by advanceObjectAnimationFrame; this
 * handler layers the cycle-completion / phase-reseed logic on top of that per-frame step.
 *
 * GROUNDING: [seen] — this is the state-0 handler of the enemy-actor animation-tick walk
 * (advanceEnemyActorStateWalk, itself [seen]); the shared phase countdown (SHARED_PHASE_COUNTDOWN)
 * and the per-frame animation stepper (advanceObjectAnimationFrame) it drives are both [seen].
 *
 * LIVE-OUT: memory only.
 *   • The stepped animation fields of this record (written by advanceObjectAnimationFrame).
 *   • The sub-position +0x05 (advanced by −(+0x09)) and, on a borrow, the frame counter +0x06.
 *   • On cycle completion: SHARED_PHASE_COUNTDOWN reloaded to RESET_TIMER (0x20) and 14 records'
 *     dispatch-state byte +0x02 forced to STATE_ACTIVE (1).
 *   Control: the return value tells the per-frame walk that ticks the pool whether to carry on —
 *   true = step to the next record; false = the cycle just completed and the pool reseed above
 *   fired, so the walk aborts for this frame (nothing is left to tick after the phase switch).
 */
export function loc_7644(m, ix = m.regs.ix) {
  const { mem8 } = m;

  // STEP 1 — skip an inactive record. Byte 0 of the record is its active flag; when it is zero the
  // slot holds no live enemy, so there is nothing to animate. Return true so the pool walk moves on
  // to the next record.
  if (mem8[ix + 0x00] === 0) return true; // inactive -> keep walking

  // STEP 2 — advance this record's animation frame for the frame (frame-hold countdown + script
  // walk over its animation sequence). This is the per-frame visual step; the cadence/cycle logic
  // below decides when the whole cycle has run its course.
  advanceObjectAnimationFrame(m, ix); // step this entry's animation

  // STEP 3 — advance the fixed-point animation-progress accumulator. Subtract the per-frame step
  // (+0x09) from the sub-position (+0x05); each time that subtraction borrows (the sub-position
  // underflows past zero) tick the frame counter (+0x06) down by one. The frame counter is the
  // high end of the accumulator: the sub-position rolling under is what carries a step up into it.
  const cur5 = mem8[ix + 0x05];
  const cur9 = mem8[ix + 0x09];
  if (cur5 < cur9) mem8[ix + 0x06] = mem8[ix + 0x06] - 1; // borrow rolls the frame counter
  mem8[ix + 0x05] = cur5 - cur9;

  // STEP 4 — while the frame counter (+0x06) is still at or above FRAME_FLOOR (6) the animation
  // cycle is not finished. Leave the record in state 0 and return true so the walk continues; the
  // record keeps animating on subsequent frames.
  if (mem8[ix + 0x06] >= FRAME_FLOOR) return true; // still animating

  // STEP 5 — the cycle has completed. Arm the shared per-frame phase countdown (SHARED_PHASE_COUNTDOWN,
  // 0x892e) to RESET_TIMER (0x20): this is the timer the state-1 handler will drain before the pool
  // advances to its next phase.
  mem8[SHARED_PHASE_COUNTDOWN] = RESET_TIMER;

  // STEP 6 — force the enemy pool into the next phase. Starting at this record and striding
  // RESET_STRIDE (0x18), write STATE_ACTIVE (1) into the dispatch-state byte (+0x02) of RESET_COUNT
  // (14) consecutive records. Since the dispatcher reads that byte to choose each record's handler,
  // this moves the whole run out of state 0 (this handler) and into state 1 (the countdown handler).
  let rec = ix;
  for (let n = 0; n < RESET_COUNT; n++) {
    mem8[rec + STATE_FIELD] = STATE_ACTIVE;
    rec = u16(rec + RESET_STRIDE);
  }

  // STEP 7 — abort the pool walk for this frame. The phase reseed above has just changed every
  // record's state, so there is no point continuing the current tick pass; return false to unwind
  // out of the walk.
  return false; // frame elapsed -> abort the walk (caller-skip)
}
