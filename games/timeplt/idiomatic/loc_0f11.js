// SPDX-License-Identifier: GPL-3.0-only
/** loc_0f11 — step one work-RAM state byte on by one and restart SEQUENCE_SUBSTEP from zero.
 * The step store truncates to eight bits, so 255 rounds to 0; the clear is unconditional and
 * stores a constant, so whatever SEQUENCE_SUBSTEP held is discarded. LIVE-OUT: those two cells. */

import { SEQUENCE_SUBSTEP } from "./names.js";

export function loc_0f11(m) {
  const { mem8 } = m;
  mem8[0xa9ab] = mem8[0xa9ab] + 1;
  mem8[SEQUENCE_SUBSTEP] = 0;
}
