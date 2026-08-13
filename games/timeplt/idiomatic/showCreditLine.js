// SPDX-License-Identifier: GPL-3.0-only
/** showCreditLine — one sequence step that refreshes the panel and caption, then reads a guard byte that is
 * BANK_LAUNCH_COOLDOWN, borrowed here as the boot tamper-check result. While FREE_PLAY is set it only advances the
 * sequence's inner index; otherwise it repaints the panel from its packed-decimal count, queues one caption request,
 * then the guard decides: nonzero transfers to an address carrying no routine (so it RAISES rather than runs); zero
 * stamps the caption strip, requests the caption line in this frame's colour, and folds a twenty-byte image run into the tamper total. LIVE-OUT: memory only. */

import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { flashCopyrightLine } from "./flashCopyrightLine.js";
import { paintCreditCountPanel } from "./paintCreditCountPanel.js";
import { postCommand } from "./postCommand.js";
import { stampCopyrightStrip } from "./stampCopyrightStrip.js";
import { sumImageBlockForTheTamperCheck } from "./sumImageBlockForTheTamperCheck.js";
import { BANK_LAUNCH_COOLDOWN, FREE_PLAY, loc_2e3e } from "./names.js";

const CAPTION_COMMAND = 1;
const CAPTION_RECORD = 8;
const BLOCK_START = 0x086b;
const BLOCK_BYTES = 20;

export function showCreditLine(m) {
  const { mem8 } = m;
  if (mem8[FREE_PLAY] !== 0) {
    advanceSequenceSubStep(m);
    return;
  }

  paintCreditCountPanel(m);
  postCommand(m, CAPTION_COMMAND, CAPTION_RECORD);
  if (mem8[BANK_LAUNCH_COOLDOWN] !== 0) return m.call(loc_2e3e);

  stampCopyrightStrip(m);
  flashCopyrightLine(m);
  return sumImageBlockForTheTamperCheck(m, BLOCK_START, BLOCK_BYTES);
}
