// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_184a — advance an actor's walk: accumulate its position, pick the walk frame,
 * then build its display record.  ROM 0x184a.
 *
 * A per-frame walk stepper, sibling to loc_1659. Where loc_1659 re-measures the actor's
 * position against a moving reference, this one carries the position FORWARD by a
 * per-frame step (a velocity), so it drives an actor that walks under its own momentum.
 * It:
 *   - moves the actor by adding its per-frame step onto the position accumulator, which
 *     wraps within a byte;
 *   - reads a sub-tile phase off the new position — its low three bits, nudged by 3 so
 *     the frame flips at the right point in the stride — and stores it;
 *   - alternates the sprite between two adjacent walk frames as that phase advances,
 *     giving the two-frame walk cycle.
 * It then hands the actor block to the record builder loc_1b5b, which writes the 4-byte
 * display record and returns straight to this routine's caller.
 *
 * Memory-equivalent to the frozen oracle — equivalence-184a.test.js.
 * GATE:     crafted-entry — reads only work RAM, so any real attract clone with its two
 *           inputs poked is a valid entry (attract never dispatches this stepper — 0 in
 *           1500 frames). The phase and sprite selection are swept over all 256 positions
 *           for several step values, including the accumulator's byte wrap, and the record
 *           builder's four writes are checked through the direct call.
 * LIVE-OUT: memory-only — the position accumulator (OBJ_X), the sub-tile phase byte, the
 *           walk-frame SPRITE_CODE, and the four record bytes loc_1b5b writes. Unlike
 *           loc_1659, this stepper stashes nothing in a register for its caller; the step
 *           value left behind is incidental scratch that nothing downstream reads.
 * NAMES:    OBJ_X, SPRITE_CODE from ram.js. The per-frame step 0x806c and the sub-tile
 *           phase byte 0x8075 stay hex — their roles are not yet grounded (the sibling
 *           writes 0x8075 as a 0/moving marker instead, so its cross-routine meaning is
 *           still open).
 */

import { OBJ_X, SPRITE_CODE } from "./ram.js";
import { loc_1b5b } from "./loc_1b5b.js";

const STEP = 0x806c; // per-frame amount added onto the position accumulator
const SUBTILE_PHASE = 0x8075; // low-3-bit sub-tile phase the walk frame is read off

export function loc_184a(m) {
  const { mem8 } = m;

  // Move the actor forward by its per-frame step. The store keeps only the low byte,
  // so the position accumulator wraps.
  mem8[OBJ_X] = mem8[OBJ_X] + mem8[STEP];

  // Walk phase: the low three bits of the new position, biased by 3 so the frame flips
  // at the right point in the stride.
  const phase = (mem8[OBJ_X] + 3) % 8;
  mem8[SUBTILE_PHASE] = phase;

  // Two-frame walk: hold the even sprite code through the first half of the phase, then
  // step to its odd neighbour once phase bit 1 is set.
  mem8[SPRITE_CODE] = phase & 2 ? 0x33 : 0x32;

  // Hand the actor block to the record builder, which writes the 4-byte display record
  // and returns straight to this routine's caller (the oracle reaches it by a tail-jump;
  // here it is a direct call).
  return loc_1b5b(m);
}
