// SPDX-License-Identifier: GPL-3.0-only
/** showCreditLine — one sequence step that refreshes the panel and caption, then reads a guard byte that is
 * BANK_LAUNCH_COOLDOWN, borrowed here as the boot tamper-check result. While FREE_PLAY is set it only advances the
 * sequence's inner index; otherwise it repaints the panel from its packed-decimal count, queues one caption request,
 * then the guard decides. Zero stamps the caption strip, requests the caption line in this frame's colour, and folds
 * a twenty-byte image run into the tamper total. Nonzero has no routine to run, so it RAISES rather than guessing.
 * LIVE-OUT: memory only. */

import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { flashCopyrightLine } from "./flashCopyrightLine.js";
import { paintCreditCountPanel } from "./paintCreditCountPanel.js";
import { postCommand } from "./postCommand.js";
import { stampCopyrightStrip } from "./stampCopyrightStrip.js";
import { sumImageBlockForTheTamperCheck } from "./sumImageBlockForTheTamperCheck.js";
import { BANK_LAUNCH_COOLDOWN, FREE_PLAY, COPYRIGHT_CAPTION_RECORD } from "./names.js";
import { NotImplemented } from "../../../boards/timeplt/io.js";

const CAPTION_COMMAND = 1;
const CAPTION_RECORD = 8;
const BLOCK_START = COPYRIGHT_CAPTION_RECORD;
const BLOCK_BYTES = 20;

export function showCreditLine(m) {
  const { mem8 } = m;
  if (mem8[FREE_PLAY] !== 0) {
    advanceSequenceSubStep(m);
    return;
  }

  paintCreditCountPanel(m);
  postCommand(m, CAPTION_COMMAND, CAPTION_RECORD);
  if (mem8[BANK_LAUNCH_COOLDOWN] !== 0) {
    throw new NotImplemented(
      "showCreditLine: the banked image checksum is not zero, so the original jumps into a table of words " +
        "that carries no routine; a genuine image never reaches this",
    );
  }

  stampCopyrightStrip(m);
  flashCopyrightLine(m);
  return sumImageBlockForTheTamperCheck(m, BLOCK_START, BLOCK_BYTES);
}
