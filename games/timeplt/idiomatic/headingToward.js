// SPDX-License-Identifier: GPL-3.0-only
/** headingToward — the heading that points from one object at a point, as one byte of a
 * 256-step
 * circle. Each of the two axes gives a distance and a sense; the senses, plus which of the two
 * distances is the shorter, name one of eight sectors, and the shorter distance over the longer
 * places the answer within that sector at one of thirty-two rungs. A sector whose byte carries the
 * marker bit counts its rungs backwards, which is what makes the answer sweep the same way all the
 * way round. Two equal distances skip all of that and read a fixed heading straight out of a
 * second, shorter table. Nothing is written. LIVE-OUT: the heading, returned and in the
 * accumulator. */

import { u8, u16 } from "../../../core/int.js";
import { fetchTableByte } from "./fetchTableByte.js";
import { offsetAddress } from "./offsetAddress.js";
import { loc_341d, loc_3415 } from "./names.js";

const FIRST_COORDINATE = 0x00;
const SECOND_COORDINATE = 0x31;

const SECOND_IS_BELOW = 0x01;
const FIRST_IS_BELOW = 0x02;
const FIRST_IS_SHORTER = 0x04;

const RUNGS_PER_SECTOR = 32;
const COUNTS_BACKWARDS = 0x20;

export function headingToward(m, point = m.regs.hl, object = m.regs.iy) {
  const { regs, mem8 } = m;

  const firstReach = mem8[point] - mem8[u16(object + FIRST_COORDINATE)];
  const secondReach =
    mem8[(point & 0xff00) | u8(point - 1)] - mem8[u16(object + SECOND_COORDINATE)];

  let sector = (secondReach < 0 ? SECOND_IS_BELOW : 0) | (firstReach < 0 ? FIRST_IS_BELOW : 0);
  const firstLeg = Math.abs(firstReach);
  const secondLeg = Math.abs(secondReach);

  if (firstLeg === secondLeg) {
    regs.hl = loc_341d;
    regs.a = sector;
    return fetchTableByte(m);
  }
  if (firstLeg < secondLeg) sector |= FIRST_IS_SHORTER;

  const shorter = Math.min(firstLeg, secondLeg);
  const longer = Math.max(firstLeg, secondLeg);
  let rung = Math.floor((shorter * RUNGS_PER_SECTOR) / longer);

  regs.hl = loc_3415;
  regs.a = sector;
  const heading = mem8[offsetAddress(m)];
  if (heading & COUNTS_BACKWARDS) rung = RUNGS_PER_SECTOR - 1 - rung;

  regs.a = u8(heading + rung);
  return regs.a;
}
