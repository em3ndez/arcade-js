// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2c31 — drive one object's appearance from a phase byte it keeps in its own record, in
 * three bands.
 *
 * At forty-two and above only the tint moves: the top two bits of the sprite's second byte are
 * kept and the low nibble of a free-running counter is dropped in beneath them, so the object
 * cycles through sixteen tints as that counter turns over and holds its shape.
 *
 * Between ten and forty-one the phase is halved into a step and that step picks a shape out of a
 * fixed sixteen-entry table, with one fixed tint. Two phases share a step, so the run of shapes
 * advances at half the speed the phase does.
 *
 * Below ten the object is only kept alive while an outside request names it: the request cell's
 * top bit must be set and the rest of it must match this record's number, or the object is retired
 * outright. While it is named, the phase advances on seven frames in every eight, a fixed shape
 * and tint are held, and the very first phase — and only that one — posts a command and clears the
 * request, so the request is consumed exactly once.
 * LIVE-OUT: memory-only.
 */

import { fetchTableByte } from "./fetchTableByte.js";
import { postCommand } from "./postCommand.js";
import { retireSlotAndSubPixel } from "./retireSlotAndSubPixel.js";
import { u8 } from "../../../core/int.js";
import { FRAME_TICK } from "./names.js";

const PHASE = 0;
const RECORD_NUMBER = 15;
const SHAPE = 1;
const ATTRIBUTE = 0x30;

const REQUEST = 0xa821;
const SHAPE_BY_STEP = 0x2c94;

const TINT_ONLY_FROM = 42;
const SHAPE_RUN_FROM = 10;
const PHASES_PER_STEP = 2;
const KEPT_TINT_BITS = 0xc0;
const CYCLED_TINT_BITS = 0x0f;
const REQUEST_PRESENT = 0x80;
const REQUEST_NUMBER = 0x7f;
const HOLD_ONE_FRAME_IN = 0x07;

const SHAPE_RUN_TINT = 60;
const HELD_SHAPE = 252;
const HELD_TINT = 108;
const FIRST_PHASE = 1;
const COMMAND = 4;
const ARGUMENT = 12;

export function loc_2c31(m, object = m.regs.ix, sprite = m.regs.iy) {
  const { mem8 } = m;
  const phase = mem8[object + PHASE];

  if (phase >= TINT_ONLY_FROM) {
    const tint = mem8[sprite + ATTRIBUTE] & KEPT_TINT_BITS;
    mem8[sprite + ATTRIBUTE] = tint + (mem8[FRAME_TICK] & CYCLED_TINT_BITS);
    return;
  }

  if (phase >= SHAPE_RUN_FROM) {
    const step = Math.floor(u8(phase - SHAPE_RUN_FROM) / PHASES_PER_STEP);
    mem8[sprite + SHAPE] = shapeForStep(m, step);
    mem8[sprite + ATTRIBUTE] = SHAPE_RUN_TINT;
    return;
  }

  const request = mem8[REQUEST];
  const named = (request & REQUEST_PRESENT) !== 0 &&
    (request & REQUEST_NUMBER) === mem8[object + RECORD_NUMBER];
  if (!named) {
    retireSlotAndSubPixel(m, object, sprite);
    return;
  }

  if ((mem8[FRAME_TICK] & HOLD_ONE_FRAME_IN) !== 0) mem8[object + PHASE] = u8(phase + 1);
  mem8[sprite + SHAPE] = HELD_SHAPE;
  mem8[sprite + ATTRIBUTE] = HELD_TINT;
  if (mem8[object + PHASE] !== FIRST_PHASE) return;
  postCommand(m, COMMAND, ARGUMENT);
  mem8[REQUEST] = 0;
}

/** The table fetch wants its base and its index in the registers it reads them from. */
function shapeForStep(m, step) {
  m.regs.hl = SHAPE_BY_STEP;
  m.regs.a = step;
  return fetchTableByte(m);
}
