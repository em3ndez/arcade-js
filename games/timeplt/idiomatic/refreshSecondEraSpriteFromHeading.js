// SPDX-License-Identifier: GPL-3.0-only
/** refreshSecondEraSpriteFromHeading — show an object pointing the way it is heading, in this family's own shape bank and
 * tint. The heading lookup supplies a shape and the byte that goes beside it; each is then shifted
 * by a fixed bias before it is stored, so the pair on the screen is a fixed distance from the pair
 * the lookup chose and the shift is the whole of what this entry adds. The shape shift is done last
 * in the accumulator, so it is left holding the shifted shape and the flags of that eight-bit add.
 * LIVE-OUT: the two cells written, and the accumulator and flags the shape shift leaves. */

import { u8 } from "../../../core/int.js";
import { F_S, F_Z, F_F3, F_F5, F_C, F_H, F_PV } from "../../../core/cpu/z80.js";
import { spriteForHeading } from "./spriteForHeading.js";

const SHAPE = 1;
const ATTRIBUTE = 0x30;
const SHAPE_BIAS = 16;
const ATTRIBUTE_BIAS = 53;

export function refreshSecondEraSpriteFromHeading(m, object = m.regs.ix, sprite = m.regs.iy) {
  const { mem8 } = m;
  const [shape, mirror] = spriteForHeading(m, object);
  mem8[sprite + ATTRIBUTE] = mirror + ATTRIBUTE_BIAS;
  const shifted = u8(shape + SHAPE_BIAS);
  mem8[sprite + SHAPE] = shifted;

  // the shape shift is an eight-bit add whose result stays in the accumulator, with the flags it sets.
  const sum = shape + SHAPE_BIAS;
  const fv =
    (shifted & 0x80 ? F_S : 0) |
    (shifted === 0 ? F_Z : 0) |
    (shifted & (F_F3 | F_F5)) |
    (sum > 0xff ? F_C : 0) |
    (((shape ^ SHAPE_BIAS ^ shifted) & 0x10) ? F_H : 0) |
    ((~(shape ^ SHAPE_BIAS) & (shape ^ shifted) & 0x80) ? F_PV : 0);
  return (m.regs.a = shifted, m.regs.f = fv);
}
