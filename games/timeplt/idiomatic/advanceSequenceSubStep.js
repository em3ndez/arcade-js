// SPDX-License-Identifier: GPL-3.0-only
/** advanceSequenceSubStep — add one to SEQUENCE_SUBSTEP and store it back; the store truncates to
 * eight bits, so 255 rounds to 0. It clamps nothing, masks nothing, branches nowhere and
 * returns nothing, so that one cell is the entire effect. */

import { SEQUENCE_SUBSTEP } from "./names.js";

export function advanceSequenceSubStep(m) {
  const { mem8 } = m;
  const step = mem8[SEQUENCE_SUBSTEP];
  mem8[SEQUENCE_SUBSTEP] = step + 1;
}
