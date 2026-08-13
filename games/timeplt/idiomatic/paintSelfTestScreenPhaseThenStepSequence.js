// SPDX-License-Identifier: GPL-3.0-only
/** paintSelfTestScreenPhaseThenStepSequence — lay out one phase of the sequenced intro/self-test screen, then step the sub-sequence.
 * It stocks an eight-byte control block (a shape byte, four fixed fields, a count and a parked
 * pointer), writes a fixed run of attribute bytes, colours three cell rows and a small block of
 * the colour plane by adding a base colour read from work RAM to fixed offsets, seeds the active
 * player's saved pen from its era, and tail-steps the sequence sub-step. LIVE-OUT: the block, the
 * attribute run, the coloured cells, the saved pen and the sub-step cell; no register is live-out. */

import { u8, u16 } from "../../../core/int.js";
import { fillCellRun } from "./fillCellRun.js";
import { setSavedPenFromEra } from "./setSavedPenFromEra.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { PEN_COLOUR, INTRO_ANIMATION_STEP, loc_a400, loc_3213, loc_a7b1, loc_a5d1, loc_a610, loc_a611, loc_a612 } from "./names.js";

const PARKED_POINTER = 0x56f1;
const ROW_STEP = -32;

const toColour = (cell) => cell & 0xfbff; // clear bit 10: attribute plane -> colour plane

export function paintSelfTestScreenPhaseThenStepSequence(m) {
  const { regs, mem8 } = m;

  mem8[INTRO_ANIMATION_STEP + 0x0] = mem8[loc_3213];
  mem8[INTRO_ANIMATION_STEP + 0x1] = 0x00;
  mem8[INTRO_ANIMATION_STEP + 0x2] = 0xff;
  mem8[INTRO_ANIMATION_STEP + 0x3] = 0x04;
  mem8[INTRO_ANIMATION_STEP + 0x4] = 0xff;
  mem8[INTRO_ANIMATION_STEP + 0x6] = 0x08; // the following cell is deliberately left untouched
  mem8[INTRO_ANIMATION_STEP + 0x7] = PARKED_POINTER & 0xff;
  mem8[INTRO_ANIMATION_STEP + 0x8] = PARKED_POINTER >> 8;

  let cur = loc_a400;
  for (let i = 0; i < 13; i++) mem8[cur++] = 0x14;
  mem8[cur++] = 0x00;
  mem8[cur++] = 0x00;
  for (let i = 0; i < 13; i++) mem8[cur++] = 0x14;
  for (let i = 0; i < 4; i++) mem8[cur++] = 0x0e;

  const base = mem8[PEN_COLOUR];

  regs.hl = toColour(loc_a7b1);
  regs.a = u8(0xa0 + base);
  fillCellRun(m);

  regs.hl = toColour(loc_a5d1);
  regs.a = u8(0x20 + base);
  fillCellRun(m);

  // three columns of the colour plane, each a cell and the cell one row above it
  paintColumn(mem8, toColour(loc_a610), u8(0xa0 + base), u8(0x20 + base));
  paintColumn(mem8, toColour(loc_a612), u8(0xe0 + base), u8(0x60 + base));
  paintColumn(mem8, toColour(loc_a611), u8(0xa0 + base), u8(0x20 + base));

  setSavedPenFromEra(m);
  return advanceSequenceSubStep(m);
}

function paintColumn(mem8, cell, here, above) {
  mem8[cell] = here;
  mem8[u16(cell + ROW_STEP)] = above;
}
