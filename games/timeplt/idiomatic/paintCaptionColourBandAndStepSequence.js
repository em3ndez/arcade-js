// SPDX-License-Identifier: GPL-3.0-only
/** paintCaptionColourBandAndStepSequence — paint a caption's colour band from a base colour. Starting at the cursor the caller
 * leaves in HL it lays the caller's A over one cell, then a run of the caller's C, then a short
 * fixed tail; next it reads the base colour and fills two colour-RAM rows and six scattered colour
 * cells, every value the base plus a fixed offset. Last it seeds the saved pen from the era and
 * steps the sequence sub-step. LIVE-OUT: the cells written; A, C, HL and DE are left as scratch. */

import { u8, u16 } from "../../../core/int.js";
import { fillCellRun } from "./fillCellRun.js";
import { setSavedPenFromEra } from "./setSavedPenFromEra.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { PEN_COLOUR, CAPTION_COLOUR_LOWER_RUN_BOTTOM, CAPTION_COLOUR_UPPER_RUN_BOTTOM, CAPTION_BAND_COLOUR_CELL0, CAPTION_BAND_COLOUR_CELL1, CAPTION_BAND_COLOUR_CELL2 } from "./names.js";

const HEAD_RUN = 13;
const TAIL_RUN = 4;
const TAIL_FILL = 0x0e;
const ROW = 0x20;

// The two colour-RAM row heads and the three scattered cells, each already through the res-2,h
// that folds a tilemap address down into colour RAM; the low copies sit one row (ROW) back.

export function paintCaptionColourBandAndStepSequence(m) {
  const { regs, mem8 } = m;
  const head = regs.a;
  const body = regs.c;

  let cur = u16(regs.hl + 1);
  mem8[cur] = head;
  for (let i = 0; i < HEAD_RUN; i++) mem8[cur = u16(cur + 1)] = body;
  for (let i = 0; i < TAIL_RUN; i++) mem8[cur = u16(cur + 1)] = TAIL_FILL;

  const base = mem8[PEN_COLOUR];

  regs.hl = CAPTION_COLOUR_LOWER_RUN_BOTTOM;
  regs.a = u8(0xa0 + base);
  fillCellRun(m);
  regs.hl = CAPTION_COLOUR_UPPER_RUN_BOTTOM;
  regs.a = u8(0x20 + base);
  fillCellRun(m);

  mem8[CAPTION_BAND_COLOUR_CELL0] = u8(0xa0 + base);
  mem8[u16(CAPTION_BAND_COLOUR_CELL0 - ROW)] = u8(0x20 + base);
  mem8[CAPTION_BAND_COLOUR_CELL2] = u8(0xe0 + base);
  mem8[u16(CAPTION_BAND_COLOUR_CELL2 - ROW)] = u8(0x60 + base);
  mem8[CAPTION_BAND_COLOUR_CELL1] = u8(0xa0 + base);
  mem8[u16(CAPTION_BAND_COLOUR_CELL1 - ROW)] = u8(0x20 + base);

  setSavedPenFromEra(m);
  advanceSequenceSubStep(m);
}
