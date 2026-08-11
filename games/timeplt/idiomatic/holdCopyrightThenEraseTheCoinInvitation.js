// SPDX-License-Identifier: GPL-3.0-only
/** holdCopyrightThenEraseTheCoinInvitation — hold one sequence step for as long as its delay cell counts, restamping the
 * copyright caption and flashing its line on every frame of the wait, then leave the step.
 *
 * The delay comes down by one per frame and nothing else happens until it reaches zero, so the
 * step lasts as many frames as the cell held on arrival — and a cell holding zero on arrival
 * wraps to 255 and waits the long way round rather than leaving at once. On the frame it
 * expires, one cell of the caption is sampled from both planes and the pair kept aside, two
 * commands go out to the ring, and the sequence moves on to its next step.
 * LIVE-OUT: memory only. */

import { u8 } from "../../../core/int.js";
import { SEQUENCE_DELAY, TAMPER_GLYPH_KONAMI } from "./names.js";
import { stampCopyrightStrip } from "./stampCopyrightStrip.js";
import { flashCopyrightLine } from "./flashCopyrightLine.js";
import { postCommand } from "./postCommand.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";

const SAMPLED_GLYPH_CELL = 0xa63c;
const SAMPLED_COLOUR_CELL = 0xa23c;

const COMMAND = 3;
const FIRST_ARGUMENT = 3;

export function holdCopyrightThenEraseTheCoinInvitation(m) {
  const { mem8 } = m;
  stampCopyrightStrip(m);
  flashCopyrightLine(m);

  const left = u8(mem8[SEQUENCE_DELAY] - 1);
  mem8[SEQUENCE_DELAY] = left;
  if (left !== 0) return;

  mem8[TAMPER_GLYPH_KONAMI] = mem8[SAMPLED_GLYPH_CELL];
  mem8[TAMPER_GLYPH_KONAMI + 1] = mem8[SAMPLED_COLOUR_CELL];

  postCommand(m, COMMAND, FIRST_ARGUMENT);
  postCommand(m, COMMAND, FIRST_ARGUMENT + 1);
  advanceSequenceSubStep(m);
}
