// SPDX-License-Identifier: GPL-3.0-only
/** blankOneLineThenGuardBlockOrDerailSequence — one turn of the line wipe, and when the wipe finishes, one tamper test.
 *
 * A single line is blanked per turn and the turn ends there while lines are still owed. On the
 * turn that clears the last one, a fixed 1024-byte block of the program image is folded together
 * with exclusive-or into one eight-bit total and compared against the total an untampered image
 * gives. Matching steps the sequence's inner index on, so the sequence carries on; not matching
 * steps the OUTER phase instead, which restarts the inner index somewhere else entirely.
 * LIVE-OUT: memory only. */

import { advanceSequencePhase } from "./advanceSequencePhase.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { blankNextLine } from "./blankNextLine.js";

const BLOCK_START = 0x4980;
const BLOCK_BYTES = 1024;
const UNTAMPERED_TOTAL = 0x43;

export function blankOneLineThenGuardBlockOrDerailSequence(m) {
  const { mem8 } = m;
  if (!blankNextLine(m)) return;

  let total = 0;
  for (let i = 0; i < BLOCK_BYTES; i++) total ^= mem8[BLOCK_START + i];

  if (total !== UNTAMPERED_TOTAL) {
    advanceSequencePhase(m);
    return;
  }
  advanceSequenceSubStep(m);
}
