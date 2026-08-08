// SPDX-License-Identifier: GPL-3.0-only
/** showCreditLine — one sequence step that refreshes the panel and the caption, then reads a guard.
 *
 * While FREE_PLAY is set the step does nothing but move the sequence's inner index on. Otherwise
 * the panel field is repainted from its packed-decimal count and one fixed caption request is
 * queued, and then a guard byte decides everything after: anything but zero hands control to an
 * address carrying no routine, so the transfer RAISES rather than running; zero stamps the caption
 * strip into the display list, asks for the caption line in this frame's colour, and folds a
 * twenty-byte run of the program image into a total for the chain that judges it. What writes the
 * guard byte is not established here.
 * LIVE-OUT: memory only — nothing this entry hands on outlives the chain it hands it to. */

import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { flashCopyrightLine } from "./flashCopyrightLine.js";
import { loc_4afb } from "./loc_4afb.js";
import { postCommand } from "./postCommand.js";
import { stampCopyrightStrip } from "./stampCopyrightStrip.js";
import { sumImageBlockForTheTamperCheck } from "./sumImageBlockForTheTamperCheck.js";
import { FREE_PLAY } from "./names.js";

const CAPTION_COMMAND = 1;
const CAPTION_RECORD = 8;
const GUARD_RESULT = 0xa817;
const TRAP = 0x2e3e;
const BLOCK_START = 0x086b;
const BLOCK_BYTES = 20;

export function showCreditLine(m) {
  const { mem8 } = m;
  if (mem8[FREE_PLAY] !== 0) {
    advanceSequenceSubStep(m);
    return;
  }

  loc_4afb(m);
  postCommand(m, CAPTION_COMMAND, CAPTION_RECORD);
  if (mem8[GUARD_RESULT] !== 0) return m.call(TRAP);

  stampCopyrightStrip(m);
  flashCopyrightLine(m);
  return sumImageBlockForTheTamperCheck(m, BLOCK_START, BLOCK_BYTES);
}
