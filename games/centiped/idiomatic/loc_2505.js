// SPDX-License-Identifier: GPL-3.0-only
import { rebuildSegmentSpriteTables } from "./rebuildSegmentSpriteTables.js";

/**
 * loc_2505 — thin entry that forwards straight to the segment sprite-table rebuild
 * and returns. A tail call: no own state, no register setup, no branches. [code]
 */
export function loc_2505(m) {
  return rebuildSegmentSpriteTables(m);
}
