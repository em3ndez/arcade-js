// SPDX-License-Identifier: GPL-3.0-only
/**
 * walkFireOneStep — step one fire a single position along its current heading: move its working X
 * one pixel the way its state points, mirror its sprite to match, advance its animation, and then
 * re-snap its working Y to the girder underneath.
 *
 * Three steps, in this order:
 *
 *   1. OBJ_STATE picks the heading, and the same branch does two things at once — it steps the
 *      working X one pixel and it sets or clears the sprite tile code's flip bit, so the mirrored
 *      sprite always faces the way the fire is moving. STATE_STEP_UP steps X up and sets the flip
 *      bit; every other state steps X down and clears it.
 *   2. The animation clock then runs over the SAME sprite code byte (and a per-fire down-counter),
 *      so the ORDER matters: the flip bit is written first and the animation step lands on top of
 *      it.
 *   3. Control falls into the slope tail, which on the girder board re-snaps the working Y to the
 *      sloped girder under the fire's new X. Off that board the tail does nothing, so elsewhere
 *      this routine is just the X step plus the sprite work.
 *
 * WHICH FIELDS THESE ARE. The stepped coordinate is the fire's WORKING X, one stage upstream of
 * the drawn OBJ_X — the per-object advance copies the working pair into the drawn pair after this
 * routine has run. Bit 7 of the sprite code is the raster flip, held alongside the animation frame
 * in the low bits.
 *
 * WHAT IS NOT ESTABLISHED: whether STATE_STEP_UP's sense should be called "left" or "right" — only
 * that it is the heading the caller re-arms at the low-X screen bound, and the one it undoes when
 * a step is refused.
 *
 * NAMESPACE, because the two are one byte apart in meaning: the pointer addresses a FIRE record, so
 * the code byte here is the object record's own OBJ_SPRITE_CODE — NOT the like-named field of a
 * four-byte hardware sprite record, which is a different namespace.
 *
 * The record pointer arrives from the caller in a register rather than as a promoted parameter,
 * because the tail this falls into reads it straight off the machine as well.
 *
 * LIVE-OUT: memory only — the fire's working X, its sprite tile code, the animation down-counter
 * and, on the girder board, the working Y. The caller consumes no register or flag left behind.
 */

import { OBJ_STATE, OBJ_SPRITE_CODE } from "./names.js";
import { stepObjectSpriteFrame } from "./stepObjectSpriteFrame.js"; // the animation clock
import { settleFireOnGirderSlope } from "./settleFireOnGirderSlope.js"; // the girder-slope Y re-snap (fall-through tail)

// Fire-record field: the working X, one stage upstream of the drawn OBJ_X. It has no registered
// name; the slope tail reaches the same field as the cross-axis input of its step.
const OBJ_WORKING_X = 0x0e;

// Bit 7 of the sprite tile code: the flip the sprite hardware reads out of the code byte, held
// alongside the animation frame in the low bits.
const SPRITE_FLIP = 0x80;

// The one travel direction that steps the working X upward; every other state steps it down.
const STATE_STEP_UP = 1;

export function walkFireOneStep(m) {
  const { regs, mem } = m;

  // The fire-record pointer the caller supplied.
  const objBase = regs.ix;
  const codeAddr = (objBase + OBJ_SPRITE_CODE) & 0xffff;
  const xAddr = (objBase + OBJ_WORKING_X) & 0xffff;

  // One direction bit, two effects: which way X moves, and which way the sprite faces.
  const code = mem.read8(codeAddr);
  if (mem.read8((objBase + OBJ_STATE) & 0xffff) === STATE_STEP_UP) {
    mem.write8(codeAddr, code | SPRITE_FLIP);
    mem.write8(xAddr, mem.read8(xAddr) + 1);
  } else {
    mem.write8(codeAddr, code & ~SPRITE_FLIP);
    mem.write8(xAddr, mem.read8(xAddr) - 1);
  }

  // Advance the animation on top of the flip bit just written (same byte — order matters).
  stepObjectSpriteFrame(m, objBase);

  // Fall through into the tail: on the girder board, re-snap the working Y under the new X.
  settleFireOnGirderSlope(m);
}
