// SPDX-License-Identifier: GPL-3.0-only
/**
 * endKongWalkAndAdvanceInterlude — once the moving sprite group reaches its rail region, either
 * reinitialize it or bounce/slide it by its current step sign.
 *
 * The second stage of the pair that walks a horizontally-moving group of ten sprites back and
 * forth during a between-boards interlude. Every frame the first stage runs, reading the
 * group's leading record X and the object's published signed per-frame step; once that X has
 * climbed to the rail region it hands control here with both values. Given them, this stage
 * chooses one of three outcomes:
 *
 *   1. X still short of 93 (the narrow band just inside the rail): reinitialize the group's
 *      object block — recopy its sprite template and clear its per-object scratch — and
 *      advance the interlude's step counter. This is the "the group arrived at the rail, reset
 *      it and step the sequence" case.
 *
 *   2. X at or past 93 with a POSITIVE step (still heading into this rail): schedule a
 *      direction reversal for the next tick and slide this frame — the group bounces off the
 *      rail.
 *
 *   3. X at or past 93 with a NEGATIVE step (already moving away): just run this frame's slide,
 *      with no reversal.
 *
 * The sign-to-outcome mapping mirrors the first stage's near-rail mapping, and together they
 * are the bounce: a reversal is scheduled only while the group is still travelling INTO the
 * rail it has just reached. This stage reads no work RAM of its own and writes none — it only
 * tests its two inputs and tail-calls the chosen handler, which does all the memory work.
 *
 * WHAT THIS DOES NOT CLAIM: that the moving figure is Kong on measured bytes. That reading
 * comes from the interlude the sequence step opens, not from the sprite data.
 *
 * Inputs: recordX = the group's leading record X; stepByte = the object's published step. The
 * machine is needed only to hand on to the chosen handler.
 *
 * LIVE-OUT: memory-only, all of it written by the handler this stage picks.
 */

import { loc_16d0 } from "./loc_16d0.js"; // schedule a reversal, then slide
import { stepKongWalk } from "./stepKongWalk.js"; // the shared group-slide motion tick
import { loc_16ee } from "../translated/loc_16ee.js"; // reinit the object block, advance the step

export function endKongWalkAndAdvanceInterlude(m, recordX, stepByte) {
  // Short of the reinit mark: the group has arrived at the rail — recopy its object block and
  // advance the sequence step counter instead of moving it this frame.
  if (recordX < 93) {
    loc_16ee(m);
    return;
  }

  // The published step's sign bit (top bit): set means the group is moving in the negative
  // (decreasing-X) direction, clear means positive.
  const stepIsNegative = (stepByte & 0x80) !== 0;

  // A positive step is still heading into this rail, so schedule a reversal before sliding
  // (bounce); a negative step is already moving away, so just slide.
  if (!stepIsNegative) {
    loc_16d0(m);
  } else {
    stepKongWalk(m);
  }
}
