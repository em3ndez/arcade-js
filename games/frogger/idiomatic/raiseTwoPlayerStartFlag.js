// SPDX-License-Identifier: GPL-3.0-only
/**
 * raiseTwoPlayerStartFlag — raise the 2-player start flag unless the mode cell is clear.
 * LIVE-OUT: memory-only.
 */
import { loc_826d, loc_825b } from "./names.js";

export function raiseTwoPlayerStartFlag(m) {
  const { mem8 } = m;
  if (mem8[loc_826d] === 0) return; // mode cell clear: leave the start flag alone
  mem8[loc_825b] = 1;
}
