// SPDX-License-Identifier: GPL-3.0-only
/** loc_08b4 — inner sequence arm: advance the interpolated pen run and bail unless it reseated to a zero row
 * integer. On the full path XOR-fold a fixed 256-byte program block; post five caption commands, paint the
 * five labelled readouts, zero a five-cell run and seat 3 in the cell after it, stamp the glyph the run's last
 * cell indexes at the cell the scratch pointer names, save that cell's colour, and step the sequence sub-index.
 *
 * The fold is an anti-tamper check. The block is program image, so on a genuine image it always folds to the
 * same byte and the mismatch arm is dead. On a tampered image the arm jumps into the vertical-blank service
 * from outside an interrupt, carrying this arm's live registers into that service's shadow-bank swap: a
 * derail, not a behaviour. There is no faithful transcription of it as a routine, so this arm raises where it
 * would derail instead.
 * LIVE-OUT: memory only. */

import { drawInterpolatedPenRun } from "./drawInterpolatedPenRun.js";
import { postCommand } from "./postCommand.js";
import { paintFiveLabelledNumericReadouts } from "./paintFiveLabelledNumericReadouts.js";
import { fetchTableByte } from "./fetchTableByte.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { PEN_ROW_CELL, SCRATCH_PTR_B } from "./names.js";
import { NotImplemented } from "../../../boards/timeplt/io.js";

const CHECKED_BLOCK = 0x4880;
const GLYPH_TABLE = 0x12c7;
const SAVED_COLOUR = 0xa990;
const CLEARED_RUN = 0xa995;

const CHECKED_BYTES = 256;
// The value the checked block folds to on a genuine image.
const GENUINE_FOLD = 0x30;
const CAPTION_COMMAND = 1;
const CAPTION_ARGUMENTS = [0x13, 0x00, 0x14, 0x15, 0x0c];
const RUN_LENGTH = 5;
const RUN_TERMINATOR = 3;
const COLOUR_PLANE_BIT = 0x400;

export function loc_08b4(m) {
  const { mem8, mem16 } = m;

  // The pen run leaves the return to the dispatch, so the early exit owes none of its own.
  drawInterpolatedPenRun(m);
  if (mem8[PEN_ROW_CELL] !== 0) return;

  let fold = 0;
  for (let i = 0; i < CHECKED_BYTES; i++) fold ^= mem8[CHECKED_BLOCK + i];
  if (fold !== GENUINE_FOLD) {
    throw new NotImplemented(
      "loc_08b4: the program-block fold reached its tamper derail; a genuine image always folds to the expected byte",
    );
  }

  for (const argument of CAPTION_ARGUMENTS) postCommand(m, CAPTION_COMMAND, argument);
  paintFiveLabelledNumericReadouts(m);

  for (let i = 0; i < RUN_LENGTH; i++) mem8[CLEARED_RUN + i] = 0;
  mem8[CLEARED_RUN + RUN_LENGTH] = RUN_TERMINATOR;

  const cell = mem16[SCRATCH_PTR_B];
  mem8[cell] = fetchTableByte(m, GLYPH_TABLE, mem8[CLEARED_RUN + RUN_LENGTH - 1]);
  mem8[SAVED_COLOUR] = mem8[cell & ~COLOUR_PLANE_BIT];

  return advanceSequenceSubStep(m);
}
