// SPDX-License-Identifier: GPL-3.0-only
/** refreshSecondEraSpriteFromHeading — show an object pointing the way it is heading, in this family's own shape bank and
 * tint. The heading lookup supplies a shape and the byte that goes beside it; each is then shifted
 * by a fixed bias before it is stored, so the pair on the screen is a fixed distance from the pair
 * the lookup chose and the shift is the whole of what this entry adds. LIVE-OUT: memory-only. */

import { spriteForHeading } from "./spriteForHeading.js";

const SHAPE = 1;
const ATTRIBUTE = 0x30;
const SHAPE_BIAS = 16;
const ATTRIBUTE_BIAS = 53;

export function refreshSecondEraSpriteFromHeading(m, object = m.regs.ix, sprite = m.regs.iy) {
  const { mem8, regs } = m;
  spriteForHeading(m, object);
  mem8[sprite + ATTRIBUTE] = regs.c + ATTRIBUTE_BIAS;
  mem8[sprite + SHAPE] = regs.b + SHAPE_BIAS;
}
