// SPDX-License-Identifier: GPL-3.0-only
import {
  SUBSTATE_FIELD3_VALUE,
  SUBSTATE_FIELD3_VRAM_ALT,
  SUBSTATE_FIELD3_HUNDREDS_VRAM_ALT,
} from "./names.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { binToPackedBcd } from "./binToPackedBcd.js";
import { drawStackedBcdDigits } from "./drawStackedBcdDigits.js";
import { armEnemyTurnAnimation } from "./armEnemyTurnAnimation.js";
import { blankActorSpriteBand } from "./blankActorSpriteBand.js";

/**
 * tickEnemyHoldThenTurnOrBlank — per-frame update for one hold-then-turn object.
 *
 * WHAT IT IS
 *   The per-frame state handler an actor record runs while it is parked in its "hold, then turn
 *   or blank" state (the enemy-actor record reaches this via its state-9 slot; the launched-hunter
 *   record via its state-2 slot). Both are ordinary stride-0x18 actor records; the same body drives
 *   whichever record is dispatched into it.
 *
 * ROLE IN THE MACHINE
 *   This is the "sit still for a while, then take the next step" beat in an object's life. Each
 *   frame it plays one step of the object's on-screen animation and burns one tick off the record's
 *   frame timer. The object simply HOLDS in place until that timer runs out — the overwhelmingly
 *   common outcome, so most frames leave here after two writes. On the single frame the timer
 *   expires the object commits to its next move: at the end of its phase run it enters the
 *   turn/select animation (it "turns around"); otherwise it advances one phase, wipes its sprite
 *   for the transition frame, and re-arms the hold for a single frame so the next state can pick up.
 *   On that same expiry frame it also refreshes one of the on-screen HUD digit fields — the bonus/
 *   tally field fed by SUBSTATE_FIELD3_VALUE — so the number on screen tracks the object's progress.
 *
 * ROM
 *   0x1518-0x1556.
 *
 * Grounding: [seen]
 *
 * LIVE-OUT: memory only — it mutates the record's own fields (frame timer, state byte, phase),
 *   repaints video-RAM HUD cells (the SUBSTATE_FIELD3 digit column at 0x85c9 and its hundreds cell
 *   at 0x85e9), and leaves behind whatever the animation step and the two tail handlers
 *   (armEnemyTurnAnimation / blankActorSpriteBand) write. No value is returned to the caller.
 */

// Byte offsets into the stride-0x18 actor record whose base address is `rec`.
const FRAME_TIMER = 0x11; //   record: per-frame countdown timer — the object holds while this is nonzero
const STATE_FIELD = 0x02; //   record: state byte, bumped on a phase advance
const PHASE = 0x16; //         record: current phase, compared against the final phase
const NEXT_PHASE = 0x13; //    record: advanced phase written on a step
// FINAL_PHASE: the last phase in the run; reaching it means "turn" instead of "step".
const FINAL_PHASE = 0x07;

export function tickEnemyHoldThenTurnOrBlank(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // --- Play one animation step, then tick the hold timer ---------------------------------------
  // Every frame in this state first advances the object's own animation (frame-hold countdown plus
  // a walk through its animation script), then spends one tick of the record's frame timer. The
  // decrement is stored back as an 8-bit value, so a timer already at 0 wraps to 0xff — the long
  // way round rather than going negative. While the timer has NOT hit zero the object is still
  // holding, so the handler simply returns; this is the exit taken on almost every frame.
  advanceObjectAnimationFrame(m, rec);
  mem8[rec + FRAME_TIMER] = mem8[rec + FRAME_TIMER] - 1; // write wraps to a byte
  if (mem8[rec + FRAME_TIMER] !== 0) return; // timer still running — most frames end here

  // --- On timer expiry: refresh the SUBSTATE_FIELD3 HUD digit field --------------------------
  // The bonus/tally count lives in SUBSTATE_FIELD3_VALUE (0x8f60) and is shown on screen at twice
  // its stored magnitude, so double it here (masked back to a byte). A zero field is blank and
  // draws nothing. Otherwise binToPackedBcd splits the doubled count into packed tens+units digits
  // plus a separate hundreds carry: the hundreds tile is written to its own video-RAM cell
  // (0x85e9) only when it is nonzero (i.e. the doubled value reached 100, so the source was >= 50),
  // and drawStackedBcdDigits paints the tens/units as two stacked digit tiles into the field's
  // digit column at 0x85c9 (tens above units, a leading zero blanked).
  const selector = (mem8[SUBSTATE_FIELD3_VALUE] << 1) & 0xff;
  if (selector !== 0) {
    const { a: digits, hundreds } = binToPackedBcd(m, selector);
    if (hundreds !== 0) mem8[SUBSTATE_FIELD3_HUNDREDS_VRAM_ALT] = hundreds;
    drawStackedBcdDigits(m, SUBSTATE_FIELD3_VRAM_ALT, digits);
  }

  // --- Decide the next move from the object's phase ---------------------------------------------
  // The record's current phase (rec+0x16) says where the object is in its run. Having reached the
  // final phase means the walk is over: tail into armEnemyTurnAnimation, which puts the record into
  // its turn/select animation state (the object turns to face the other way). Nothing more happens
  // here on that branch.
  const phase = mem8[rec + PHASE];
  if (phase === FINAL_PHASE) return armEnemyTurnAnimation(m, rec); // final phase: enter turn anim

  // --- Not the final phase: advance one step ---------------------------------------------------
  // Record the next phase (current + 1) in rec+0x13, reload the frame timer to a single tick so the
  // object holds for exactly one more frame, and bump the record's state byte (rec+0x02) to move it
  // onward through its life cycle.
  mem8[rec + NEXT_PHASE] = phase + 1;
  mem8[rec + FRAME_TIMER] = 0x01;
  mem8[rec + STATE_FIELD] = mem8[rec + STATE_FIELD] + 1;

  // --- Blank the sprite for the transition frame -----------------------------------------------
  // Play one more animation step, then immediately spend the single tick just loaded into the frame
  // timer: 1 decrements to 0, so the guard below normally falls straight through. (It only returns
  // early in the impossible case that the reload left the timer nonzero.) With the timer drained,
  // tail into blankActorSpriteBand, which zeroes the 0x17-byte sprite band of this record — erasing
  // the object from the display for this transition frame before its next state takes over.
  advanceObjectAnimationFrame(m, rec);
  mem8[rec + FRAME_TIMER] = mem8[rec + FRAME_TIMER] - 1;
  if (mem8[rec + FRAME_TIMER] !== 0) return;

  return blankActorSpriteBand(m, rec);
}
