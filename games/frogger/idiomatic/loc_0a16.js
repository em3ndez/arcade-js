// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0a16 — render the time-remaining bar.
 *
 * Selects the active countdown byte, draws that many bar tiles up a fixed column capped with a
 * terminator, or returns without drawing when the countdown is inactive.
 * LIVE-OUT: memory-only.
 */
import { loc_83e4, loc_83e5, loc_83e6, PLAY_FLAG, loc_83fd, loc_abbe } from "./names.js";

const BAR_TILE = 77;
const CAP_TILE = 16;
const ROW_UP = 32;

export function loc_0a16(m) {
  const { mem8 } = m;
  if (mem8[loc_83e4] === 255) return;

  let src = loc_83e4;
  if (mem8[PLAY_FLAG] !== 0) src = mem8[loc_83fd] === 1 ? loc_83e5 : loc_83e6;

  let count = mem8[src];
  let p = loc_abbe;
  while (count-- > 0) {
    mem8[p] = BAR_TILE;
    p = (p - ROW_UP) & 0xffff;
  }
  mem8[p] = CAP_TILE;
}
