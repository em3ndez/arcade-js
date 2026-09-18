// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderScoreReadouts — lay the three score-readout numbers into their on-screen display cells.
 *
 * The game keeps three numeric readouts side by side (the score / high-score display). Each has
 * a small source record in work RAM — a 3-tile label block then the readout's two-byte value —
 * and the three records sit back to back. This paints all three: the label tiles are copied
 * verbatim into the display cell, then the value is moved into the shared staging slot the digit
 * unpacker reads and the unpacker splits it into digit cells right after the label. Callers seed
 * the records first, then hand off here to draw them.
 */

import { unpackScoreDigits } from "./unpackScoreDigits.js";
import { SCORE_DISPLAY_LOW, SCORE_READOUT_DEST, HIGH_SCORE_TABLE } from "./names.js";

const READOUT_COUNT = 3;

// The three source records sit back to back: each is a 3-tile label block then a
// two-byte value, so records start 5 bytes apart.
const SOURCE_BASE = HIGH_SCORE_TABLE;
const SOURCE_STRIDE = 5;
const LABEL_TILES = 3; // also the offset of the value within a record

// Each readout's display cells: the label block, then the digit cells the unpacker
// fills. The three readouts are 9 cells apart, and the digits follow the 3 label tiles.
const DIGIT_DEST_BASE = SCORE_READOUT_DEST + LABEL_TILES;
const DEST_STRIDE = 9;

export function renderScoreReadouts(m) {
  const { mem8, mem16, regs } = m;

  for (let readout = 0; readout < READOUT_COUNT; readout++) {
    const source = SOURCE_BASE + readout * SOURCE_STRIDE;
    const labelDest = SCORE_READOUT_DEST + readout * DEST_STRIDE;
    const digitDest = DIGIT_DEST_BASE + readout * DEST_STRIDE;

    // Copy the label tiles verbatim into this readout's display cell.
    for (let i = 0; i < LABEL_TILES; i++) mem8[labelDest + i] = mem8[source + i];

    // Stage this readout's value where the digit unpacker reads it, hand it the
    // digit-cell base, and let it fill the digits.
    mem16[SCORE_DISPLAY_LOW] = mem16[source + LABEL_TILES];
    regs.hl = digitDest;
    unpackScoreDigits(m);
  }
}
