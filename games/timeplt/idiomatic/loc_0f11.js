// SPDX-License-Identifier: GPL-3.0-only
/** loc_0f11 — step SEQUENCE_PHASE on by one and restart SEQUENCE_SUBSTEP from zero.
 * The step store truncates to eight bits, so 255 rounds to 0; the clear is unconditional and
 * stores a constant, so whatever SEQUENCE_SUBSTEP held is discarded. LIVE-OUT: those two cells. */

import { SEQUENCE_PHASE, SEQUENCE_SUBSTEP } from "./names.js";

export function loc_0f11(m) {
  const { mem8 } = m;
  mem8[SEQUENCE_PHASE] = mem8[SEQUENCE_PHASE] + 1;
  mem8[SEQUENCE_SUBSTEP] = 0;
}
