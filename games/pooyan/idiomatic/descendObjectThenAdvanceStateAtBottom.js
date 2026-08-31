// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { TILE_SUM_ONCE_LATCH } from "./names.js";
/**
 * descendObjectThenAdvanceStateAtBottom — the "state 1" step of a descending on-screen object.
 *
 * WHAT IT IS
 *   One handler in the little per-object state machine that drives a descending object (a
 *   record based at IX / `rec`). While the object is in state 1 this routine is called once
 *   per frame: it keeps the object's animation playing, walks the object one step further
 *   down the screen, and — only at the instant it touches the bottom — hands the object off
 *   to its next state and re-arms a playfield-integrity check.
 *
 * ROLE IN THE MACHINE
 *   The per-frame object driver sweeps a table of enemy-actor records and, for each one,
 *   selects a state handler by the record's state byte (IX+2). This is the handler for
 *   state 1 — "falling". An object stays here, descending frame after frame, until its
 *   16-bit vertical counter runs out at the bottom row; then it moves on to the next state.
 *
 *   ROM 0x6aa8. Grounding: [seen].
 *
 * THE OBJECT RECORD FIELDS IT TOUCHES
 *   IX+5 / IX+6  a 16-bit vertical position stored little-endian (low byte IX+5, high byte
 *                IX+6). The object descends as this value is decreased toward zero.
 *   IX+9         the descent speed: how much to subtract from the position each frame.
 *   IX+2         the object's state byte (which handler runs next frame).
 *   (plus the animation-script fields stepped by the shared animation sequencer)
 *
 * LIVE-OUT: none — memory-only. Every effect lands in the object record and in the
 * shared tilemap-sum latch; the routine returns no value that anything reads.
 */

export function descendObjectThenAdvanceStateAtBottom(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Keep the object's picture moving: step its animation sequence by one frame's worth of
  // time (frame-hold countdown, or the next tile/attribute from its animation script). This
  // is the same per-object animator shared by every moving actor on the playfield.
  advanceObjectAnimationFrame(m, rec);

  // Descend one step. The object's vertical position is a 16-bit little-endian value held in
  // IX+6 (high) : IX+5 (low); subtracting the per-frame speed (IX+9) from the low byte moves
  // it downward. If the subtraction underflows the low byte, that borrow is carried up by
  // decrementing the high byte (IX+6) — exactly how the 16-bit value crosses each 0x100
  // boundary as it counts down toward the bottom row.
  const lo = mem8[rec + 5];
  const speed = mem8[rec + 9];
  mem8[rec + 5] = lo - speed;
  if (lo - speed < 0) mem8[rec + 6] = mem8[rec + 6] - 1;

  // Not at the bottom yet: while the high byte of the position (IX+6) is still non-zero the
  // object has further to fall, so leave it in state 1 and come back next frame.
  if (mem8[rec + 6] !== 0) return; // still above the bottom row

  // The object has reached the bottom (position high byte hit 0). Re-arm the one-shot
  // playfield-tilemap integrity check by clearing its run-once latch at 0x8f56: with the
  // latch clear, the tilemap checksum is allowed to sum the playfield once more on its next
  // qualifying frame (it otherwise sets this latch to 1 and refuses to re-run).
  mem8[TILE_SUM_ONCE_LATCH] = 0x00; // re-arm the tilemap-sum latch

  // Hand the object off to its next behaviour: bump the record's state byte (IX+2) so a
  // different state handler drives it from the following frame onward.
  mem8[rec + 2] = mem8[rec + 2] + 1; // advance to the next state
}
