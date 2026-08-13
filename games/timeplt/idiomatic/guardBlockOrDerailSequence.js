// SPDX-License-Identifier: GPL-3.0-only
/** guardBlockOrDerailSequence — check that a fixed span of program space still folds to the value it is supposed
 * to, then carry the sequence on. The fold is a running exclusive-or over the whole span; a
 * constant is added to the result, and the pair is chosen so that an untouched span nets to zero.
 * Netting to zero steps the sequence's inner index on by one, which is the ordinary path. Netting
 * to anything else instead throws the sequence a whole phase forward, discarding the inner index —
 * an arm that cannot be reached while the span holds what it is checked against.
 * LIVE-OUT: whichever of the two steps ran. */

import { advanceSequencePhase } from "./advanceSequencePhase.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { u8, u16 } from "../../../core/int.js";
import { fetchTableByte_ADDR } from "./names.js";

const GUARDED_BYTES = 768;
const EXPECTED_COMPLEMENT = 0x52;

export function guardBlockOrDerailSequence(m) {
  const { mem8 } = m;
  let fold = 0;
  for (let i = 0; i < GUARDED_BYTES; i++) fold ^= mem8[u16(fetchTableByte_ADDR + i)];

  if (u8(EXPECTED_COMPLEMENT + fold) !== 0) {
    advanceSequencePhase(m);
    return;
  }
  advanceSequenceSubStep(m);
}
