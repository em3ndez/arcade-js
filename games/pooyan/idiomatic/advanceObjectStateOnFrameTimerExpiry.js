// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { advanceFallingEnemyAndTallyCatchOnLanding } from "./advanceFallingEnemyAndTallyCatchOnLanding.js";
/**
 * advanceObjectStateOnFrameTimerExpiry — object state-14 handler.  ROM 0x3f72 (0x3f72-0x3f7b).
 * Grounding: [seen]
 *
 * WHAT IT IS
 *   Every actor in the arena — enemy, projectile, falling object — carries a uniform 0x18-byte
 *   record, and byte +0x02 of that record holds the actor's position in its own state machine.
 *   Once per frame a per-record dispatcher masks +0x02 to five bits and jumps through a table of
 *   seventeen handlers (states 0 through 0x10); this routine is the handler installed at index 14.
 *
 * ITS ROLE IN THE MACHINE
 *   State 14 is a timed *dwell* inside a falling-enemy sequence: state 13 falls straight through
 *   into it, and it falls straight through into state 15 — the catch/landing handler
 *   advanceFallingEnemyAndTallyCatchOnLanding. Its whole job is to pace that transition. It keeps
 *   the actor animating while a per-record countdown at +0x11 runs, and only when that countdown
 *   lapses does it promote the actor to the next state and let the landing logic take over. So the
 *   actor lingers in state 14 for exactly (initial +0x11) frames of on-screen animation before the
 *   catch is evaluated.
 *
 * THE RECORD FIELDS IT TOUCHES  (the actor record is addressed by IX)
 *   +0x02  state index   — the jump-table selector; bumped by one on expiry to enter state 15.
 *   +0x11  frame timer    — a down-counter the lead-actor handlers use to pace their transitions.
 *   (advanceObjectAnimationFrame additionally walks the animation fields at +0x0c..+0x10.)
 *
 * LIVE-OUT: none — memory only; the fall-through delegate yields nothing the caller reads.
 */
const FRAME_TIMER = 0x11; // record offset +0x11: the frame-delay down-counter that gates the state advance
const STATE_FIELD = 0x02; // record offset +0x02: the state-machine index, advanced by one on expiry

export function advanceObjectStateOnFrameTimerExpiry(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Step 1 — keep the actor animating even while it dwells here.
  // Runs the record's animation stepper (ROM 0x4006): it ages the frame-hold countdown at +0x0e
  // and, when that reaches zero, walks the animation script at +0x0c/+0x0d to pull the next
  // tile/attribute/hold. The visible sprite therefore advances every frame the actor waits in
  // state 14; the state promotion below is timed independently by the +0x11 counter.
  advanceObjectAnimationFrame(m, rec); // tick the animation

  // Step 2 — count the dwell down by one frame (ROM 0x3f75: dec (ix+0x11)).
  // The frame timer at +0x11 is decremented modulo 256 (the byte wraps like the hardware DEC).
  // While it is still non-zero the dwell has not elapsed, so leave the actor in state 14 and
  // return to the per-record sweep — the record will be revisited next frame and re-enter here.
  const timer = (mem8[rec + FRAME_TIMER] - 1) & 0xff;
  mem8[rec + FRAME_TIMER] = timer;
  if (timer !== 0) return; // still counting down

  // Step 3 — the dwell has expired: promote the actor and hand off (ROM 0x3f79: inc (ix+0x02)).
  // Bumping the state byte at +0x02 moves the actor from state 14 to state 15, then control falls
  // straight through into that state's handler, advanceFallingEnemyAndTallyCatchOnLanding (ROM
  // 0x3f7c), so the newly entered catch/landing state already runs this same frame rather than
  // waiting for the next dispatch pass.
  mem8[rec + STATE_FIELD] = mem8[rec + STATE_FIELD] + 1;
  return advanceFallingEnemyAndTallyCatchOnLanding(m, rec); // fall through into the next state handler
}
