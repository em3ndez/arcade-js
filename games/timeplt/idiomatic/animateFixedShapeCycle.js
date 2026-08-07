// SPDX-License-Identifier: GPL-3.0-only
/** animateFixedShapeCycle — give a sprite entry the next frame of an eight-frame cycle, and one fixed control
 * byte beside it. The frame number comes from a free-running cell, halved and then taken modulo
 * eight, so the shape changes on every other tick of that cell and repeats forever; the eight
 * shapes are consecutive codes from one base. Nothing about the object itself is read, so two
 * entries written in the same tick get the same shape.
 * LIVE-OUT: the two bytes written. */

import { FRAME_TICK } from "./names.js";

const SHAPE_SLOT = 1;
const CONTROL_SLOT = 48;
const FIRST_SHAPE = 64;
const SHAPES = 8;
const CONTROL_BYTE = 68;

export function animateFixedShapeCycle(m) {
  const { mem8, regs } = m;
  const frame = (mem8[FRAME_TICK] >> 1) & (SHAPES - 1);
  mem8[regs.iy + SHAPE_SLOT] = FIRST_SHAPE + frame;
  mem8[regs.iy + CONTROL_SLOT] = CONTROL_BYTE;
}
