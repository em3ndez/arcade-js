// SPDX-License-Identifier: GPL-3.0-only
// Bump a counter while it stays below its cap; at/above the cap do nothing. On a bump, raise the event
// flag and enqueue a command word (the counter pointer is the enqueue's restored HL).
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import { loc_4002, loc_41c9 } from "./names.js";

const CAP = 99;
const EVENT_WORD = (7 << 8) | 1;

export function loc_191e(m) {
  const { mem8 } = m;

  if (mem8[loc_4002] >= CAP) return;
  mem8[loc_4002]++;
  mem8[loc_41c9] = 1;
  return enqueueCommandWord(m, EVENT_WORD, loc_4002);
}
