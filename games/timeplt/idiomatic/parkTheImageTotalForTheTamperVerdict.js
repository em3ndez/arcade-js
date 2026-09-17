// SPDX-License-Identifier: GPL-3.0-only
/** parkTheImageTotalForTheTamperVerdict — park the running total in the register the verdict arm reads from, then hand on by transfer. LIVE-OUT: memory and registers. */

import { advanceSequenceUnlessImageTampered } from "./advanceSequenceUnlessImageTampered.js";

export function parkTheImageTotalForTheTamperVerdict(m, total = m.regs.a) {
  // the total flows through B into the verdict arm, which reads it off the register bridge.
  m.regs.b = total;
  return advanceSequenceUnlessImageTampered(m);
}
