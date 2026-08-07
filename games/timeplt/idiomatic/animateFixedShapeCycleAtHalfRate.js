// SPDX-License-Identifier: GPL-3.0-only
/** animateFixedShapeCycleAtHalfRate — animate one sprite entry from a free-running counter: the
 * counter's bits one to three pick one of eight consecutive shapes, so the run cycles once every
 * sixteen counts, and the byte beside the shape is pinned to one constant. Nothing about the object
 * itself is read, so every entry driven through here animates in step. LIVE-OUT: memory-only. */

import { FRAME_TICK } from "./names.js";

const SHAPE = 1;
const ATTRIBUTE = 0x30;
const FIRST_SHAPE = 80;
const SHAPES = 8;
const COUNTS_PER_SHAPE = 2;
const TINT = 10;

export function animateFixedShapeCycleAtHalfRate(m, sprite = m.regs.iy) {
  const { mem8 } = m;
  const step = Math.floor(mem8[FRAME_TICK] / COUNTS_PER_SHAPE) % SHAPES;
  mem8[sprite + SHAPE] = FIRST_SHAPE + step;
  mem8[sprite + ATTRIBUTE] = TINT;
}
