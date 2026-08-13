// SPDX-License-Identifier: GPL-3.0-only
/** trampolineToSelectFoldBlock — a bare transfer: control leaves for one fixed destination and does not come back.
 * No cell is read or written, no register moves. LIVE-OUT: whatever the destination leaves. */

import { selectFoldBlock } from "./selectFoldBlock.js";

export function trampolineToSelectFoldBlock(m) {
  return selectFoldBlock(m);
}
