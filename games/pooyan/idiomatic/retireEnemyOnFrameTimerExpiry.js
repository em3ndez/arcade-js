// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { blankActorSpriteBand } from "./blankActorSpriteBand.js";
/**
 * retireEnemyOnFrameTimerExpiry — per-frame tick for one enemy-actor object record.
 *
 * WHAT IT IS
 *   The once-per-frame handler for a single object record whose on-screen life is bounded
 *   by a short countdown. The record base sits in IX; every field this routine touches is an
 *   offset from that base. ROM 0x154d-0x1556. Grounding tag: [seen].
 *
 * ROLE IN THE MACHINE
 *   Enemy actors live in a table of fixed-stride object records that the per-frame sweep hands
 *   out one at a time. A record that has entered its dying/retiring phase runs through here each
 *   frame: its animation keeps playing while a per-frame down-counter at record+0x11 runs, and
 *   the frame the counter reaches zero the object is retired — its whole record band is wiped, so
 *   it stops being drawn and its slot is free again. This is the "play the death animation for a
 *   few frames, then vanish" step.
 *
 *   The two things it leans on:
 *     - advanceObjectAnimationFrame — steps this record's animation sequence one frame (see below).
 *     - blankActorSpriteBand — the retire action: zeroes the record's 0x17-byte sprite band.
 *
 * RECORD FIELD IT OWNS
 *   +0x11  frame timer — a per-frame delay counter. It paces the object's final transition and,
 *          on reaching zero, triggers the retire.
 *
 * LIVE-OUT: none — both exits are memory-only (the animation-frame step, and on expiry the band
 *   blank). It reports nothing back to the sweep; the sweep simply moves to the next record.
 */

const FRAME_TIMER = 0x11; // record+0x11: the per-frame down-counter that bounds this object's life

export function retireEnemyOnFrameTimerExpiry(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // STEP 1 — keep the animation moving.
  // Step this object's animation sequence for the current frame. advanceObjectAnimationFrame
  // (ROM 0x4006) hangs on the record's frame-hold at +0x0e: while that is nonzero it just decrements
  // the hold, otherwise it walks the record's own animation-stream pointer at +0x0c/+0x0d to pull the
  // next frame (new tile into +0x10, attribute into +0x0f, fresh hold into +0x0e). The death/retire
  // animation therefore keeps playing every frame, independently of the retirement countdown below.
  advanceObjectAnimationFrame(m, rec); // step the animation sequence

  // STEP 2 — count the retirement timer down one frame.
  // Decrement the frame timer at record+0x11, wrapping in a single memory byte (& 0xff models the
  // 8-bit decrement of the hardware). Write the new value straight back so it persists to next frame.
  const timer = (mem8[rec + FRAME_TIMER] - 1) & 0xff;
  mem8[rec + FRAME_TIMER] = timer;

  // STEP 3 — still counting: leave the object alive.
  // While the timer has not yet reached zero the object survives; return so the sweep advances to
  // the next record. The animation stepped in STEP 1 is already committed, so the object redraws
  // in its new frame this pass and this handler runs again next frame with the timer one lower.
  if (timer !== 0) return; // frame timer still running

  // STEP 4 — timer elapsed: retire the object.
  // The countdown hit zero, so hand the record to blankActorSpriteBand (ROM 0x3553), which fills the
  // 0x17-byte sprite band from IX with zero. That wipes the record's drawable fields, removing the
  // object from the display and freeing its slot for a later spawn.
  return blankActorSpriteBand(m, rec); // timer elapsed -> blank the sprite band
}
