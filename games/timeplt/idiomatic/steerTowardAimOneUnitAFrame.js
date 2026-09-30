// SPDX-License-Identifier: GPL-3.0-only
/** steerTowardAimOneUnitAFrame — turn an object's heading one step toward the heading it aims at. The direction is
 * chosen on the difference PLUS ONE, so the turn is the shorter way round everywhere except at a
 * gap of exactly one short of a half turn, where the offset tips it to the longer side. The same
 * offset stands the heading still at two differences rather than at a band centred on the aim: the
 * aim reached exactly, and the aim one step behind it. That is what stops it hunting, and it is
 * lopsided — turning forward the heading ends on the aim, turning back it ends with the aim one
 * step behind and stays there.
 *
 * ROM 0x4201-0x421E (frozen lift translated/loc_4201.js). Grounding: [seen].
 *
 * Role in the machine: the turning half of an enemy's homing, used in the middle eras (under MAME
 * it ran in eras 2 and 3 and never in era 0 or 4). The caller at 0x4117 calls this, then a flier
 * and a sprite dresser. It turns on every dispatch, one unit at a time — unlike its sibling
 * steerTowardAimAtFixedRate, which steps two units and rests one frame in four.
 *
 * `object` is the object's sixteen-byte record (IX on the Z80): +1 the aim heading, +2 the heading
 * it flies on, both on a 256-step circle.
 *
 * LIVE-OUT: memory-only. */

import { u8, u16 } from "../../../core/int.js";

// Record bytes: the heading the object wants, and the one it is flying on.
const AIM_HEADING = 1;
const HEADING = 2;
// Half of the 256-step circle: the direction test (`cp 0x80` at 0x420C).
const HALF_TURN = 128;
// One heading unit per dispatch (`add a,0x01` / `sub 0x01`).
const STEP = 1;

// The gap is biased by one (`add a,0x01`) before both tests; under 2 (`cp 0x02`) means stand still.
const TEST_OFFSET = 1;
const STANDING_BAND = 2;

export function steerTowardAimOneUnitAFrame(m, object = m.regs.ix) {
  const { mem8 } = m;
  // How far the aim lies ahead of the heading, as a wrapping eight-bit angle, plus the offset.
  // Gaps of 0 and 255 (on the aim, or one step past it) come out as 1 and 0: stop turning.
  const headingCell = u16(object + HEADING);
  const heading = mem8[headingCell];
  const decidedOn = u8(mem8[u16(object + AIM_HEADING)] - heading + TEST_OFFSET);
  if (decidedOn < STANDING_BAND) return;
  // Otherwise turn one unit: up while the offset gap is under a half turn, down from a half turn
  // on. The heading byte wraps at 256.
  mem8[headingCell] = decidedOn < HALF_TURN ? heading + STEP : heading - STEP;
}
