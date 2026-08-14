// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearTwoPlayerFrameCells — zero five cells, but only when the play-mode cell holds 2.
 * LIVE-OUT: memory-only.
 */
import { PLAY_FLAG, loc_814f, loc_814e, loc_8145, loc_8146, loc_8147 } from "./names.js";

const TWO_PLAYER = 2;

export function clearTwoPlayerFrameCells(m) {
  const { mem8 } = m;
  if (mem8[PLAY_FLAG] !== TWO_PLAYER) return;
  mem8[loc_814f] = 0;
  mem8[loc_814e] = 0;
  mem8[loc_8145] = 0;
  mem8[loc_8146] = 0;
  mem8[loc_8147] = 0;
}
