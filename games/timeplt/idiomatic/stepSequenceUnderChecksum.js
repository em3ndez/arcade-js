// SPDX-License-Identifier: GPL-3.0-only
/** stepSequenceUnderChecksum — step the sequence sub-step on, and on the way past check that a block of the program
 * image still adds up to what it is supposed to. The block, its start and length, the value the
 * running total starts from and where the expected total is read from are ALL fixed here, so on
 * an unaltered image the comparison has one answer and only one arm can run. The other arm neither
 * stops nor reports: it advances the sequence PHASE, a different cell from the sub-step, so a
 * failed check derails the sequence rather than halting. LIVE-OUT: the sub-step, plus the phase. */

import { advanceSequencePhase } from "./advanceSequencePhase.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { u8, u16 } from "../../../core/int.js";

const BLOCK_START = 0x0bcc;
const BLOCK_BYTES = 256;
const STARTING_TOTAL = 137;
const EXPECTED_TOTAL = 0x1a50;

export function stepSequenceUnderChecksum(m) {
  const { mem8 } = m;
  let total = STARTING_TOTAL;
  for (let i = 0; i < BLOCK_BYTES; i++) total = u8(total + mem8[u16(BLOCK_START + i)]);

  if (total !== mem8[EXPECTED_TOTAL]) advanceSequencePhase(m);
  advanceSequenceSubStep(m);
}
