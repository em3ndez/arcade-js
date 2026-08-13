// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveObjectAppearanceByPhaseBand — drive one object's appearance from a phase byte in its own record, in three bands.
 *
 * At 42+ only the tint moves: the sprite's top two attribute bits are kept and a free-running
 * counter's low nibble dropped beneath them, cycling sixteen tints while the shape holds.
 * Between 10 and 41 the phase is halved into a step that picks a shape from a sixteen-entry table
 * (one fixed tint), so shapes advance at half the phase's speed.
 * Below 10 the object lives only while CLAIM_TOKEN names it — top bit set and low seven bits
 * matching this record's number, else it is retired; while named the phase advances seven frames in
 * eight, a fixed shape and tint hold, and only its first phase posts a command and clears the token,
 * consuming it once. LIVE-OUT: memory-only.
 */

import { fetchTableByte } from "./fetchTableByte.js";
import { postCommand } from "./postCommand.js";
import { retireSlotAndSubPixel } from "./retireSlotAndSubPixel.js";
import { u8 } from "../../../core/int.js";
import { CLAIM_TOKEN, FRAME_TICK, loc_2c94 } from "./names.js";

const PHASE = 0;
const RECORD_NUMBER = 15;
const SHAPE = 1;
const ATTRIBUTE = 0x30;

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

export function driveObjectAppearanceByPhaseBand(m, object = m.regs.ix, sprite = m.regs.iy) {
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

  const request = mem8[CLAIM_TOKEN];
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
  mem8[CLAIM_TOKEN] = 0;
}

/** The table fetch wants its base and its index in the registers it reads them from. */
function shapeForStep(m, step) {
  m.regs.hl = loc_2c94;
  m.regs.a = step;
  return fetchTableByte(m);
}
