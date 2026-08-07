// SPDX-License-Identifier: GPL-3.0-only
/** animateSelectedShapeCycle — give one object the shape that shows it in this frame's animation phase, and stamp
 * the fixed attribute that goes beside it. The phase is two bits taken from the middle of the
 * free-running frame counter, so the shape turns over every fourth frame; a byte of the object's
 * own record, counted from one, steps the shape number on in fours, so each value of that byte
 * owns a block of four consecutive shapes and the phase picks one inside it. Every step is
 * byte-wide, so a record byte large enough to run the sum past the end wraps rather than clamps.
 * LIVE-OUT: memory only — one shape byte and one attribute byte. */

import { u8 } from "../../../core/int.js";
import { FRAME_TICK } from "./names.js";

const PHASE_SHIFT = 2;
const PHASES = 4;

const SHAPE_BLOCK = 4;
const SHAPE_CODE = 1;
const ATTRIBUTE = 0x30;

const FIRST_SHAPE = 0xd8;
const ATTRIBUTE_VALUE = 0x61;

export function animateSelectedShapeCycle(m) {
  const { regs, mem8 } = m;
  const object = regs.ix;
  const entry = regs.iy;

  const phase = (mem8[FRAME_TICK] >> PHASE_SHIFT) & (PHASES - 1);
  const block = u8(mem8[object + SHAPE_BLOCK] - 1);

  mem8[entry + SHAPE_CODE] = FIRST_SHAPE + phase + PHASES * block;
  mem8[entry + ATTRIBUTE] = ATTRIBUTE_VALUE;
}
