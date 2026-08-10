// SPDX-License-Identifier: GPL-3.0-only
/** foldImageBlockIntoSignatureThenAdvanceSequence — raise one flag cell to all bits set, take a signature of a block of the program image,
 * and step the inner sequence index on. The block and its length are chosen elsewhere; the running
 * total starts from a single image byte, and where it lands is a second cell this file writes and
 * never reads. A second pointer is walked in step with the block and contributes nothing to the
 * total. What reads either cell is not established here. LIVE-OUT: memory-only. */

import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { foldBlockIntoTotal } from "./foldBlockIntoTotal.js";
import { loc_4bd9 } from "./loc_4bd9.js";

const FLAG_CELL = 0xaa3f;
const ALL_BITS = 255;
const SECOND_WALK_START = 0x17b9;
const SEED_BYTE = 0x27c0;
const SIGNATURE_CELL = 0xaa6f;

export function foldImageBlockIntoSignatureThenAdvanceSequence(m) {
  const { mem8, regs } = m;
  mem8[FLAG_CELL] = ALL_BITS;

  loc_4bd9(m);
  const blockStart = regs.hl;
  const blockLength = regs.b;
  mem8[SIGNATURE_CELL] = foldBlockIntoTotal(
    m,
    mem8[SEED_BYTE],
    blockStart,
    SECOND_WALK_START,
    blockLength,
  );

  advanceSequenceSubStep(m);
}
