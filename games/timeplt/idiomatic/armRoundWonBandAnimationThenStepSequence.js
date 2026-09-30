// SPDX-License-Identifier: GPL-3.0-only
/** armRoundWonBandAnimationThenStepSequence — set up the band animation a won round plays, then step the sub-sequence.
 * It stocks the animation's eight-byte control block (the step seed, the flash tick, the two band
 * pass countdowns, the colour-cycle and colour-flood countdowns and the band script's start), lays the band's backing
 * picture along the first row of the character plane, colours the band's rows and stub cells by
 * adding the pen colour to fixed offsets, seeds the active player's saved pen from its era, and
 * tail-steps the sequence sub-step. LIVE-OUT: the block, the backing row, the coloured cells, the
 * saved pen and the sub-step cell; no register is live-out. */

import { u8, u16 } from "../../../core/int.js";
import { fillCellRun } from "./fillCellRun.js";
import { setSavedPenFromEra } from "./setSavedPenFromEra.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { PEN_COLOUR, INTRO_ANIMATION_STEP, CHAR_PLANE_BASE, INTRO_ANIMATION_STEP_SEED, BAND_SCRIPT_START, CHAR_PLANE_LOWER_RUN_BOTTOM, CHAR_PLANE_UPPER_RUN_BOTTOM, CHAR_PLANE_STUB_LEFT_BOTTOM, CHAR_PLANE_COLUMN_MID_BOTTOM, CHAR_PLANE_STUB_RIGHT_BOTTOM } from "./names.js";

const ROW_STEP = -32;

const toColour = (cell) => cell & ~(1 << 10); // clear bit 10: attribute plane -> colour plane

export function armRoundWonBandAnimationThenStepSequence(m) {
  const { mem8 } = m;

  mem8[INTRO_ANIMATION_STEP + 0x0] = mem8[INTRO_ANIMATION_STEP_SEED];
  mem8[INTRO_ANIMATION_STEP + 0x1] = 0x00;
  mem8[INTRO_ANIMATION_STEP + 0x2] = 0xff;
  mem8[INTRO_ANIMATION_STEP + 0x3] = 0x04;
  mem8[INTRO_ANIMATION_STEP + 0x4] = 0xff;
  mem8[INTRO_ANIMATION_STEP + 0x6] = 0x08; // the following cell is deliberately left untouched
  mem8[INTRO_ANIMATION_STEP + 0x7] = BAND_SCRIPT_START;
  mem8[INTRO_ANIMATION_STEP + 0x8] = BAND_SCRIPT_START >> 8;

  let cur = CHAR_PLANE_BASE;
  for (let i = 0; i < 13; i++) mem8[cur++] = 0x14;
  mem8[cur++] = 0x00;
  mem8[cur++] = 0x00;
  for (let i = 0; i < 13; i++) mem8[cur++] = 0x14;
  for (let i = 0; i < 4; i++) mem8[cur++] = 0x0e;

  const base = mem8[PEN_COLOUR];

  fillCellRun(m, u8(0xa0 + base), toColour(CHAR_PLANE_LOWER_RUN_BOTTOM));

  fillCellRun(m, u8(0x20 + base), toColour(CHAR_PLANE_UPPER_RUN_BOTTOM));

  // three columns of the colour plane, each a cell and the cell one row above it
  paintColumn(mem8, toColour(CHAR_PLANE_STUB_LEFT_BOTTOM), u8(0xa0 + base), u8(0x20 + base));
  paintColumn(mem8, toColour(CHAR_PLANE_STUB_RIGHT_BOTTOM), u8(0xe0 + base), u8(0x60 + base));
  paintColumn(mem8, toColour(CHAR_PLANE_COLUMN_MID_BOTTOM), u8(0xa0 + base), u8(0x20 + base));

  setSavedPenFromEra(m);
  return advanceSequenceSubStep(m);
}

function paintColumn(mem8, cell, here, above) {
  mem8[cell] = here;
  mem8[u16(cell + ROW_STEP)] = above;
}
