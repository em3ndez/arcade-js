// SPDX-License-Identifier: GPL-3.0-only
/** guardBlockOrDerailSequence — check that a fixed span of program space still folds to the value it is supposed
 * to, then carry the sequence on. The fold is a running exclusive-or over the whole span; a
 * constant is added to the result, and the pair is chosen so that an untouched span nets to zero.
 * Netting to zero steps the sequence's inner index on by one, which is the ordinary path. Netting
 * to anything else instead throws the sequence a whole phase forward, discarding the inner index —
 * an arm that cannot be reached while the span holds what it is checked against.
 *
 * ROM 0x3252-0x326B (frozen lift translated/loc_3252.js). Grounding: [seen] (names.js ROUTINES 0x3252).
 *
 * Role in the machine: one of a family of anti-tamper steps in the sequence machine; this one's
 * failure arm derails the sequence (advanceSequencePhase) rather than halting the machine. Each arm
 * is a tail jump and never both run. names.js records that under MAME the failure jump at 0x3266
 * is never taken and the pass tail at 0x3269 runs every time.
 *
 * LIVE-OUT: whichever of the two steps ran. */

import { advanceSequencePhase } from "./advanceSequencePhase.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { u8, u16 } from "../../../core/int.js";
import { fetchTableByte_ADDR } from "./names.js";

// The span is 0x300 bytes from 0x0008 (fetchTableByte's own code onward); a genuine image folds it
// to 0xAE, and 0x52 + 0xAE wraps to zero.
const GUARDED_BYTES = 768;
const EXPECTED_COMPLEMENT = 0x52;

export function guardBlockOrDerailSequence(m) {
  const { mem8 } = m;
  // XOR every byte of the span into one byte, starting from zero.
  let fold = 0;
  for (let i = 0; i < GUARDED_BYTES; i++) fold ^= mem8[u16(fetchTableByte_ADDR + i)];

  // Mismatch: advance the outer phase (the ROM's `jp nz,0x0f11`).
  if (u8(EXPECTED_COMPLEMENT + fold) !== 0) {
    advanceSequencePhase(m);
    return;
  }
  // Match: step the inner index (the ROM's `jp 0x0f1a`).
  advanceSequenceSubStep(m);
}
