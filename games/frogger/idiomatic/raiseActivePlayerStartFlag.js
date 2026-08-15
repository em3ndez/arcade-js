// SPDX-License-Identifier: GPL-3.0-only
/**
 * raiseActivePlayerStartFlag — 2-player start-flag helper. Player 1 delegates to the guarded raise-start helper;
 * otherwise it raises the start flag directly. LIVE-OUT: memory-only (the caller discards A right after).
 */
import { loc_825b, ACTIVE_PLAYER } from "./names.js";
import { raiseTwoPlayerStartFlag } from "./raiseTwoPlayerStartFlag.js";

const ACTIVE_PLAYER_ONE = 1;

export function raiseActivePlayerStartFlag(m) {
  const { mem8 } = m;
  if (mem8[ACTIVE_PLAYER] === ACTIVE_PLAYER_ONE) return raiseTwoPlayerStartFlag(m);
  mem8[loc_825b] = 1;
}
