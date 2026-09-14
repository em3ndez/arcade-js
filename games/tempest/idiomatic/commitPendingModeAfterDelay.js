// SPDX-License-Identifier: GPL-3.0-only
import { FRAME_COUNTER, MODE_DELAY_GUARD, MODE_DELAY_TIMER, GAME_MODE, GAME_MODE_PENDING } from "./names.js";
import { rotateBlasterAroundRim } from "./rotateBlasterAroundRim.js";

// While the guard flag is clear, run down the delay counter; when it lands on zero
// arm the next state and clear the guard, then delegate the spinner update.
export function commitPendingModeAfterDelay(m, y = m.regs.y) {
  const { mem8 } = m;
  if ((mem8[FRAME_COUNTER] & mem8[MODE_DELAY_GUARD]) !== 0) return rotateBlasterAroundRim(m, y);

  let count = mem8[MODE_DELAY_TIMER];
  if (count !== 0) {
    count = (count - 1) & 0xff;
    mem8[MODE_DELAY_TIMER] = count;
  }
  if (count === 0) {
    mem8[GAME_MODE] = mem8[GAME_MODE_PENDING];
    mem8[MODE_DELAY_GUARD] = 0x00;
  }
  return rotateBlasterAroundRim(m, y);
}
