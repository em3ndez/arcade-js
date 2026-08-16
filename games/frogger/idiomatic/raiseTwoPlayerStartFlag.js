// SPDX-License-Identifier: GPL-3.0-only
/**
 * raiseTwoPlayerStartFlag — raise the 2-player start flag unless the mode cell is clear.
 * LIVE-OUT: memory-only.
 */
import { TWO_PLAYER_MODE_FLAG, TWO_PLAYER_START_FLAG } from "./names.js";

export function raiseTwoPlayerStartFlag(m) {
  const { mem8 } = m;
  if (mem8[TWO_PLAYER_MODE_FLAG] === 0) return; // mode cell clear: leave the start flag alone
  mem8[TWO_PLAYER_START_FLAG] = 1;
}
