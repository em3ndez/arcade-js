// SPDX-License-Identifier: GPL-3.0-only
/** buildCopyrightScreenThenVerifyImage — lay out the title/attract copyright screen, then run the anti-tamper check:
 * request the flashing copyright line, stamp the copyright caption strip, post caption commands
 * (command 1, arguments 0,1,3..7,20,21) to the ring, then XOR-fold a 24-byte program block and
 * step the sequence sub-step when it matches, else drop into the failure landing. LIVE-OUT: memory. */

import { u8 } from "../../../core/int.js";
import { flashCopyrightLine } from "./flashCopyrightLine.js";
import { stampCopyrightStrip } from "./stampCopyrightStrip.js";
import { postCommand } from "./postCommand.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { loc_08fa } from "./loc_08fa.js";
import { COPYRIGHT_IMAGE_CHECKSUM_BASE } from "./names.js";

const CAPTION_COMMAND = 1;
const CAPTION_ARGUMENTS = [0, 1, 3, 4, 5, 6, 7, 20, 21];
const CHECKSUM_BLOCK = COPYRIGHT_IMAGE_CHECKSUM_BASE;
const CHECKSUM_LENGTH = 24;
const CHECKSUM_MATCH = 0xc9;

export function buildCopyrightScreenThenVerifyImage(m) {
  const { mem8 } = m;

  flashCopyrightLine(m);
  stampCopyrightStrip(m);
  for (const argument of CAPTION_ARGUMENTS) postCommand(m, CAPTION_COMMAND, argument);

  let fold = 0;
  let low = CHECKSUM_BLOCK & 0xff;
  const page = CHECKSUM_BLOCK & (0xff << 8);
  for (let i = 0; i < CHECKSUM_LENGTH; i++) {
    fold ^= mem8[page + low];
    low = u8(low + 1);
  }

  // On a genuine image the fold matches, so the failure landing is never taken; it is a bare throw
  // that reads nothing, so the register/borrow-flag seat it once read back is dead — dropped.
  return fold !== CHECKSUM_MATCH ? loc_08fa(m) : advanceSequenceSubStep(m);
}
