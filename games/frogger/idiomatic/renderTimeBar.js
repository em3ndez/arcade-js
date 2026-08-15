// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderTimeBar — render the time-remaining bar.
 *
 * Selects the active countdown byte, draws that many bar tiles up a fixed column capped with a
 * terminator, or returns without drawing when the countdown is inactive.
 * LIVE-OUT: memory-only.
 */
import { SHARED_TIME_BYTE, loc_83e5, loc_83e6, PLAY_FLAG, ACTIVE_PLAYER, loc_abbe } from "./names.js";

const BAR_TILE = 77;
const CAP_TILE = 16;
const ROW_UP = 32;

export function renderTimeBar(m) {
  const { mem8 } = m;
  if (mem8[SHARED_TIME_BYTE] === 255) return;

  let src = SHARED_TIME_BYTE;
  if (mem8[PLAY_FLAG] !== 0) src = mem8[ACTIVE_PLAYER] === 1 ? loc_83e5 : loc_83e6;

  let count = mem8[src];
  let p = loc_abbe;
  while (count-- > 0) {
    mem8[p] = BAR_TILE;
    p = (p - ROW_UP) & 0xffff;
  }
  mem8[p] = CAP_TILE;
}
