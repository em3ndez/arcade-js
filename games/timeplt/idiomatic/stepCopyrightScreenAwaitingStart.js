// SPDX-License-Identifier: GPL-3.0-only
/** stepCopyrightScreenAwaitingStart — one title/attract sequence arm (table-dispatched): re-stamp the copyright strip,
 * re-request the flashing copyright line, sample one cell into a two-byte record; then hand off to
 * the one-player start when 1-player start is held, return when the credit count is one, else
 * queue one command pair and step the sequence sub-step. LIVE-OUT: memory only. */

import { stampCopyrightStrip } from "./stampCopyrightStrip.js";
import { flashCopyrightLine } from "./flashCopyrightLine.js";
import { sampleCellGlyphAndColour } from "./sampleCellGlyphAndColour.js";
import { startOnePlayerGame } from "./startOnePlayerGame.js";
import { postCommand } from "./postCommand.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { CREDIT_COUNT, IN0_MIRROR, TAMPER_GLYPH_STRIP, loc_a61c } from "./names.js";

const ONE_PLAYER_START = 0x08;
const COMMAND = 1;
const ARGUMENT = 25;

export function stepCopyrightScreenAwaitingStart(m) {
  const { mem8 } = m;
  stampCopyrightStrip(m);
  flashCopyrightLine(m);
  sampleCellGlyphAndColour(m, loc_a61c, TAMPER_GLYPH_STRIP);
  if (mem8[IN0_MIRROR] & ONE_PLAYER_START) return startOnePlayerGame(m);
  if (mem8[CREDIT_COUNT] === 1) return;
  postCommand(m, COMMAND, ARGUMENT);
  return advanceSequenceSubStep(m);
}
