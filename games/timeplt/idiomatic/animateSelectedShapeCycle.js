// SPDX-License-Identifier: GPL-3.0-only
/**
 * animateSelectedShapeCycle — give one sprite entry the current frame of a four-frame shape
 * cycle, from the block a record byte selects, and one fixed attribute beside it.
 *
 * ROM 0x2B38-0x2B51 (loc_2b38). Grounding: [seen] (names.js ROUTINES 0x2B38).
 *
 * What it is: objects live in slots with a record (read through `object`) and a sprite-shadow
 * entry (written through `entry`; shape code at +1, attribute byte — colour and flip — at +0x30),
 * which publishSpriteShadow copies to the hardware sprite banks once a frame. This routine picks
 * the entry's shape from two things:
 *   - the animation PHASE: two bits from the middle of FRAME_TICK (0xA980) [seen], the
 *     once-per-frame counter, so the shape turns over every fourth frame and repeats every
 *     sixteen;
 *   - a BLOCK chosen by byte +4 of the object's own record, counted from one: each value of that
 *     byte owns a run of four consecutive shape codes, and the phase picks one inside it.
 *
 * "Selected" is the difference from animateFixedShapeCycle, whose base is a literal; here the base
 * moves in fours with the record byte. The name does not claim what that record byte IS — only
 * that it selects.
 *
 * Role in the machine: read taps under MAME counted zero dispatches on two tapes that stayed in
 * eras 0-1 and a steady stream on a third that held the era at 4.
 *
 * Every step is byte-wide, as the ROM's 8-bit accumulator is, so a record byte large enough to
 * run the sum past 0xFF wraps rather than clamps.
 *
 * Parameters: `object` — the object's record (IX in the ROM);
 *             `entry`  — its sprite-shadow entry (IY in the ROM).
 *
 * LIVE-OUT: memory only — one shape byte and one attribute byte.
 */

import { u8 } from "../../../core/int.js";
import { FRAME_TICK } from "./names.js";

// The phase is FRAME_TICK's bits two and three (`rrca / rrca / and 0x03`).
const PHASE_SHIFT = 2;
const PHASES = 4;

// Record offset of the block-selecting byte, and the entry offsets written.
const SHAPE_BLOCK = 4;
const SHAPE_CODE = 1;
const ATTRIBUTE = 0x30;

// The shape codes start at 0xD8 (`add a,0xd8`); the attribute is always 0x61.
const FIRST_SHAPE = 0xd8;
const ATTRIBUTE_VALUE = 0x61;

export function animateSelectedShapeCycle(m, object = m.regs.ix, entry = m.regs.iy) {
  const { mem8 } = m;

  // The phase: `ld a,(0xa980) / rrca / rrca / and 0x03` — two rotates bring bits 2-3 down to the
  // bottom and the mask keeps only them.
  const phase = (mem8[FRAME_TICK] >> PHASE_SHIFT) & (PHASES - 1);
  // The block: `ld a,(ix+0x04) / sub 0x01` — the record byte counts from one, so it is made
  // zero-based first; byte-wide, so a record byte of 0 becomes 0xFF rather than -1.
  const block = u8(mem8[object + SHAPE_BLOCK] - 1);

  // The shape: `add a,a / add a,a / add a,b` — four times the block plus (base + phase), all in
  // one byte, which the byte store reproduces by truncating.
  mem8[entry + SHAPE_CODE] = FIRST_SHAPE + phase + PHASES * block;
  // The attribute beside it is pinned to its one constant (`ld (iy+0x30),0x61`).
  mem8[entry + ATTRIBUTE] = ATTRIBUTE_VALUE;
}
