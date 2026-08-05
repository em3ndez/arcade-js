// SPDX-License-Identifier: GPL-3.0-only
/** loc_0f1a — add one to SEQUENCE_STEP and store it back; the store truncates to
 * eight bits, so 255 rounds to 0. It clamps nothing, masks nothing, branches nowhere and
 * returns nothing, so that one cell is the entire effect. */

import { SEQUENCE_STEP } from "./names.js";

export function loc_0f1a(m) {
  const { mem8 } = m;
  const step = mem8[SEQUENCE_STEP];
  mem8[SEQUENCE_STEP] = step + 1;
}
