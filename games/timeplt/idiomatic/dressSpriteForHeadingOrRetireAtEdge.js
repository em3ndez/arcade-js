// SPDX-License-Identifier: GPL-3.0-only
/** dressSpriteForHeadingOrRetireAtEdge — dress one object's sprite entry so it shows the way it is heading, unless the object
 * has just reached the field edge, in which case it is retired instead. When the era cell holds one
 * fixed value the object is given a plain two-frame flutter and its wind-down counter is stepped,
 * capped, or closed out once it overruns; on any other era a heading-quadrant picks a shape pair and
 * the era picks a colour, and one half of the compass swaps the pair into the two entry slots in its
 * own colour while the other half biases that colour by half a page.
 * LIVE-OUT: the object's sprite entry and wind-down cell, plus whatever the retire or close-out
 * tail leaves. */

import { u8, u16 } from "../../../core/int.js";
import { loc_3cc4 } from "./loc_3cc4.js";
import { retireEntryPairIntoCooldown } from "./retireEntryPairIntoCooldown.js";
import { offsetAddress } from "./offsetAddress.js";
import { loc_44c9 } from "./loc_44c9.js";
import { loc_44dc } from "./loc_44dc.js";
import { ERA_INDEX, FRAME_TICK } from "./names.js";

const FLUTTER_ERA = 0x04;
const SETTLED = 0x07;

const HEADING = 2;
const QUADRANT_SEED = 4;
const WIND_DOWN = 6;

const SHAPE_LO = 1;
const SHAPE_HI = 3;
const COLOUR_LO = 0x30;
const COLOUR_HI = 0x32;

const SHAPE_PAIRS = 0x44f1;
const COLOUR_TABLE = 0x4531;

const FLUTTER_CODE = 0x70;
const CLOSED_OUT = 0x80;
const HEADING_BIAS = 0x40;
const HALF = 0x80;

export function dressSpriteForHeadingOrRetireAtEdge(m) {
  const { regs, mem8 } = m;
  const record = regs.ix;
  const entry = regs.iy;

  if (loc_3cc4(m)) return retireEntryPairIntoCooldown(m);

  const era = mem8[ERA_INDEX];

  if (era === FLUTTER_ERA) {
    const seed = mem8[record + QUADRANT_SEED];
    if (seed !== SETTLED) {
      const counter = u8(mem8[record + WIND_DOWN] + 1);
      mem8[record + WIND_DOWN] = counter;
      regs.c = counter;
      if (counter & CLOSED_OUT) return loc_44c9(m);
      if (u8(seed + 2) < counter) mem8[record + WIND_DOWN] = CLOSED_OUT;
    }
    mem8[entry + COLOUR_LO] = FLUTTER_CODE;
    mem8[entry + COLOUR_HI] = FLUTTER_CODE;
    return loc_44dc(m);
  }

  const index = u8(u8(era * 16) + (mem8[FRAME_TICK] & 0x02));
  const quadrant = (u8(SETTLED - mem8[record + QUADRANT_SEED]) >> 1) & 0x03;
  regs.hl = SHAPE_PAIRS;
  regs.a = u8(quadrant * 4 + index);
  offsetAddress(m);
  const shapeLo = mem8[regs.hl];
  const shapeHi = mem8[u16(regs.hl + 1)];
  regs.hl = COLOUR_TABLE;
  regs.a = era;
  offsetAddress(m);
  const colour = mem8[regs.hl];

  if (u8(mem8[record + HEADING] + HEADING_BIAS) < HALF) {
    mem8[entry + SHAPE_LO] = shapeHi;
    mem8[entry + SHAPE_HI] = shapeLo;
    mem8[entry + COLOUR_LO] = colour;
    mem8[entry + COLOUR_HI] = colour;
  } else {
    mem8[entry + SHAPE_LO] = shapeLo;
    mem8[entry + SHAPE_HI] = shapeHi;
    mem8[entry + COLOUR_LO] = u8(colour + HALF);
    mem8[entry + COLOUR_HI] = u8(colour + HALF);
  }
}
