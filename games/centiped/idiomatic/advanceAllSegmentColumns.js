// SPDX-License-Identifier: GPL-3.0-only
import { advanceSegmentColumns } from "./advanceSegmentColumns.js";

/**
 * advanceAllSegmentColumns — advance the whole three-column centipede-body strip.
 *
 * Preloads the column cursor to the last column (index 2) and hands off to the per-column
 * advance, which walks the cursor down to the first column. [code]
 */
export function advanceAllSegmentColumns(m) {
  return advanceSegmentColumns(m, 2);
}
