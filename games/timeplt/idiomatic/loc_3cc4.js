// SPDX-License-Identifier: GPL-3.0-only
/** loc_3cc4 — answer whether an object has arrived at a boundary, choosing WHICH boundary from the
 * heading in its record. Half the compass hands the question straight on to the test that owns the
 * band closest to the wrap; the other half tests the band of three that sits directly below it on
 * the same sprite-entry coordinate, and only when that misses does the question pass to the test
 * taken on the other coordinate. The two halves of the compass therefore ask about two adjacent
 * and non-overlapping bands, so which side the object is coming from picks its own line. Nothing
 * is written. LIVE-OUT: the answer, returned and mirrored into carry. */

import { u8, u16 } from "../../../core/int.js";
import { F_C } from "../../../core/cpu/z80.js";
import { hasDriftedOffTheField } from "./hasDriftedOffTheField.js";
import { loc_3ce1 } from "./loc_3ce1.js";

const HEADING_IN_RECORD = 2;
const COORDINATE = 0x31;
const BAND = 3;
const STARTS_BELOW_WRAP = 19;
const QUARTER_TURN = 64;
const HALF_A_TURN = 128;

export function loc_3cc4(m, object = m.regs.ix, spriteEntry = m.regs.iy) {
  const { mem8, regs } = m;
  const turned = u8(mem8[u16(object + HEADING_IN_RECORD)] + QUARTER_TURN);
  if (turned >= HALF_A_TURN) return hasDriftedOffTheField(m, spriteEntry);

  const arrived = u8(mem8[u16(spriteEntry + COORDINATE)] + STARTS_BELOW_WRAP) < BAND;
  if (!arrived) return loc_3ce1(m, spriteEntry);
  regs.f |= F_C;
  return true;
}
