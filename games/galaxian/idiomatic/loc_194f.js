// SPDX-License-Identifier: GPL-3.0-only
// Step the counter at the pointer toward its ceiling of 99. At the ceiling, done. Above it, pin it back
// down to the ceiling. Below it, bump it, raise the ready flag, and queue the advance command word.
import { loc_41c9 } from "./names.js";
import { clampCreditsToMax } from "./clampCreditsToMax.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";

const CEILING = 99;

export function loc_194f(m, cell = m.regs.hl) {
  const { mem8 } = m;

  const value = mem8[cell];
  if (value === CEILING) return;                          // already at the ceiling
  if (value > CEILING) return clampCreditsToMax(m, cell); // overshot -> pin back down

  mem8[cell] = mem8[cell] + 1; // bump toward the ceiling
  mem8[loc_41c9] = 1;          // raise the ready flag
  return enqueueCommandWord(m, (7 << 8) | 1); // queue command word (channel 7, param 1)
}
