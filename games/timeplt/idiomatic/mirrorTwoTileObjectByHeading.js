// SPDX-License-Identifier: GPL-3.0-only
/** mirrorTwoTileObjectByHeading — dress a two-entry object: give each of its two sprite entries one
 * of a consecutive pair of shape codes, and both of them the same attribute byte. Which entry takes
 * the lower code turns over with the object's heading, at the half-turn boundary, and the attribute
 * changes by exactly one bit at the same boundary — so the pair swaps ends together and still reads
 * as one object rather than two. The base of the pair steps in fours by how many hits the object
 * has left, counted from the most it can take, so it wears its damage; and one bit of the
 * free-running frame counter alternates it, so it flickers between two shapes every other frame.
 * LIVE-OUT: memory only — four bytes. */

import { u8 } from "../../../core/int.js";
import { FRAME_TICK, HITS_REMAINING } from "./names.js";

const ALTERNATE_BIT = 0x02;
const MOST_HITS = 3;
const SHAPES_PER_DAMAGE_STEP = 4;
const FIRST_SHAPE = 0xa0;

const HEADING = 2;
const FIRST_ENTRY_SHAPE = 1;
const SECOND_ENTRY_SHAPE = 3;
const FIRST_ENTRY_ATTRIBUTE = 0x30;
const SECOND_ENTRY_ATTRIBUTE = 0x32;

const HALF_TURN = 0x80;
const QUARTER_TURN = 0x40;
const ATTRIBUTE_FORWARD = 0xed;
const ATTRIBUTE_REVERSED = 0x6d;

export function mirrorTwoTileObjectByHeading(m) {
  const { regs, mem8 } = m;
  const object = regs.ix;
  const entry = regs.iy;

  const alternate = mem8[FRAME_TICK] & ALTERNATE_BIT;
  const damage = u8(MOST_HITS - mem8[HITS_REMAINING]);
  const shape = u8(FIRST_SHAPE + SHAPES_PER_DAMAGE_STEP * damage + alternate);

  const reversed = u8(mem8[object + HEADING] + QUARTER_TURN) < HALF_TURN;
  const lower = reversed ? SECOND_ENTRY_SHAPE : FIRST_ENTRY_SHAPE;
  const upper = reversed ? FIRST_ENTRY_SHAPE : SECOND_ENTRY_SHAPE;
  const attribute = reversed ? ATTRIBUTE_REVERSED : ATTRIBUTE_FORWARD;

  mem8[entry + lower] = shape;
  mem8[entry + upper] = shape + 1;
  mem8[entry + FIRST_ENTRY_ATTRIBUTE] = attribute;
  mem8[entry + SECOND_ENTRY_ATTRIBUTE] = attribute;
}
