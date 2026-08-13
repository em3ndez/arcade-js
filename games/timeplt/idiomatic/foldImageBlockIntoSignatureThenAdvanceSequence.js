// SPDX-License-Identifier: GPL-3.0-only
/** foldImageBlockIntoSignatureThenAdvanceSequence — raise one flag cell to all bits set, take a signature of a block of the program image,
 * and step the inner sequence index on. The block and its length are chosen elsewhere; the running
 * total starts from a single image byte, and where it lands is a second cell this file writes and
 * never reads. A second pointer is walked in step with the block and contributes nothing to the
 * total. What reads either cell is not established here. LIVE-OUT: memory-only. */

import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { foldBlockIntoTotal } from "./foldBlockIntoTotal.js";
import { trampolineToSelectFoldBlock } from "./trampolineToSelectFoldBlock.js";
import { TAMPER_IMAGE_SIGNATURE, loc_27c0, loc_aa3f, guardBlockOrBlankDisplay_ADDR } from "./names.js";

const ALL_BITS = 255;

export function foldImageBlockIntoSignatureThenAdvanceSequence(m) {
  const { mem8, regs } = m;
  mem8[loc_aa3f] = ALL_BITS;

  trampolineToSelectFoldBlock(m);
  const blockStart = regs.hl;
  const blockLength = regs.b;
  mem8[TAMPER_IMAGE_SIGNATURE] = foldBlockIntoTotal(
    m,
    mem8[loc_27c0],
    blockStart,
    guardBlockOrBlankDisplay_ADDR,
    blockLength,
  );

  advanceSequenceSubStep(m);
}
