// SPDX-License-Identifier: GPL-3.0-only
/**
 * advance50mObjectStateOnRandomGate — step the 50m board object at recordBase to its next state,
 * but only on frames where four selected bits of the shared random accumulator are all clear
 * (about one in sixteen), so it dwells an unpredictable length of time.
 *
 * LIVE-OUT: memory-only — the one state byte, and only on the frames the gate opens.
 */

import { RANDOM } from "./names.js";

export function advance50mObjectStateOnRandomGate(m, recordBase) {
  const { mem8 } = m;

  if ((mem8[RANDOM] & 0x3c) !== 0) return;

  mem8[recordBase] = mem8[recordBase] + 1;
}
