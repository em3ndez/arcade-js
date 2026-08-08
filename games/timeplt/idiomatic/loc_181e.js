// SPDX-License-Identifier: GPL-3.0-only
/** loc_181e — one step of a screen-clearing sequence. Every sprite is parked out of sight; the
 * glyph and colour showing at one fixed character cell are copied into one fixed two-byte record;
 * the line wipe is armed to run from the plane's fifth line; and the sequence's inner index is
 * stepped on, which is the last thing done. Both the cell and the record are fixed here, so
 * nothing a caller was holding chooses either. LIVE-OUT: memory. */

import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { armLineWipeFromFifthLine } from "./armLineWipeFromFifthLine.js";
import { hideAllSprites } from "./hideAllSprites.js";
import { sampleCellGlyphAndColour } from "./sampleCellGlyphAndColour.js";

const SAMPLED_CELL = 0xa5fc;
const SAMPLE_RECORD = 0xacbe;

export function loc_181e(m) {
  hideAllSprites(m);
  sampleCellGlyphAndColour(m, SAMPLED_CELL, SAMPLE_RECORD);
  armLineWipeFromFifthLine(m);
  advanceSequenceSubStep(m);
}
