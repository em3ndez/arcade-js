// SPDX-License-Identifier: GPL-3.0-only
/** parkTheImageTotalForTheTamperVerdict — park the running total where the verdict arm reads it, then hand on by
 * transfer: the original moves it from the accumulator to B, out of the way of the address arithmetic that
 * clobbers the accumulator on the way to the verdict. The walked-off pointer rides along untouched.
 * LIVE-OUT: the verdict arm's memory and return. */

import { advanceSequenceUnlessImageTampered } from "./advanceSequenceUnlessImageTampered.js";

export function parkTheImageTotalForTheTamperVerdict(m, total = m.regs.a, pointer = m.regs.hl) {
  return advanceSequenceUnlessImageTampered(m, total, pointer);
}
