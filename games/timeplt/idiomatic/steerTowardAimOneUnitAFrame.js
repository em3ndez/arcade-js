// SPDX-License-Identifier: GPL-3.0-only
/** steerTowardAimOneUnitAFrame — turn an object's heading one step toward the heading it aims at. The direction is
 * chosen on the difference PLUS ONE, so the turn is the shorter way round everywhere except at a
 * gap of exactly one short of a half turn, where the offset tips it to the longer side. The same
 * offset stands the heading still at two differences rather than at a band centred on the aim: the
 * aim reached exactly, and the aim one step behind it. That is what stops it hunting, and it is
 * lopsided — turning forward the heading ends on the aim, turning back it ends with the aim one
 * step behind and stays there. LIVE-OUT: memory-only. */

import { u8, u16 } from "../../../core/int.js";

const AIM_HEADING = 1;
const HEADING = 2;
const HALF_TURN = 128;
const STEP = 1;

const TEST_OFFSET = 1;
const STANDING_BAND = 2;

export function steerTowardAimOneUnitAFrame(m, object = m.regs.ix) {
  const { mem8 } = m;
  const headingCell = u16(object + HEADING);
  const heading = mem8[headingCell];
  const decidedOn = u8(mem8[u16(object + AIM_HEADING)] - heading + TEST_OFFSET);
  if (decidedOn < STANDING_BAND) return;
  mem8[headingCell] = decidedOn < HALF_TURN ? heading + STEP : heading - STEP;
}
