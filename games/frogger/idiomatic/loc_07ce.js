// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_07ce — raise the 2-player start flag unless the mode cell is clear.
 * LIVE-OUT: memory-only.
 */
import { loc_826d, loc_825b } from "./names.js";

export function loc_07ce(m) {
  const { mem8 } = m;
  if (mem8[loc_826d] === 0) return; // mode cell clear: leave the start flag alone
  mem8[loc_825b] = 1;
}
