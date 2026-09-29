// SPDX-License-Identifier: GPL-3.0-only
/** postAttractInfoCaptions — one arm of the two-level sequence machine: stamps the copyright strip,
 * flashes the copyright line, then posts a fixed run of caption codes to the command ring as
 * (1, code) pairs, two of them chosen by two work cells, then bumps the sequence counter twice on the
 * high branch and once on the low. LIVE-OUT: memory. */

import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { stampCopyrightStrip } from "./stampCopyrightStrip.js";
import { flashCopyrightLine } from "./flashCopyrightLine.js";
import { postCommand } from "./postCommand.js";
import { BONUS_LIFE_SETTING, CREDIT_COUNT } from "./names.js";

const CAPTION_COMMAND = 0x01;
const LEADING_CAPTIONS = [0x01, 0x14, 0x15];
const BONUS_CAPTIONS_LOW = 0x0f; // this pair when the bonus-life setting is 0
const BONUS_CAPTIONS_HIGH = 0x11; // this pair otherwise
const TRAILING_CAPTIONS = [0x16, 0x00];
const TWO_CREDITS = 2;
const TWO_CREDIT_CAPTION = 0x19;
const ONE_CREDIT_CAPTION = 0x17;

export function postAttractInfoCaptions(m) {
  const { mem8 } = m;
  const post = (code) => postCommand(m, CAPTION_COMMAND, code);

  stampCopyrightStrip(m);
  flashCopyrightLine(m);

  for (const code of LEADING_CAPTIONS) post(code);
  const bonus = mem8[BONUS_LIFE_SETTING] === 0 ? BONUS_CAPTIONS_LOW : BONUS_CAPTIONS_HIGH;
  post(bonus);
  post(bonus + 1);
  for (const code of TRAILING_CAPTIONS) post(code);

  if (mem8[CREDIT_COUNT] >= TWO_CREDITS) {
    post(TWO_CREDIT_CAPTION);
    advanceSequenceSubStep(m);
    return advanceSequenceSubStep(m);
  }
  post(ONE_CREDIT_CAPTION);
  return advanceSequenceSubStep(m);
}
