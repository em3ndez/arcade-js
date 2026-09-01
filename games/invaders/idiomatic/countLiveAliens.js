// SPDX-License-Identifier: GPL-3.0-only
import { ALIEN_COUNT, LAST_ALIEN_FLAG } from "./names.js";
import { activePlayerPageBase } from "./activePlayerPageBase.js";

// Tally the live cells across the active player's alien field, publish the count, and flag a lone survivor.
export function countLiveAliens(m) {
  const base = activePlayerPageBase(m);
  let count = 0;
  for (let i = 0; i < 0x37; i++) {
    if (m.mem8[base + i] !== 0) count++;
  }
  m.mem8[ALIEN_COUNT] = count;
  if (count === 1) m.mem8[LAST_ALIEN_FLAG] = 0x01;
}
