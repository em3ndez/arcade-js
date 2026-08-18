// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepDiveFrameCounter — tick a dive frame counter one step. When it has drained to zero, reload it
 * from the surface-timer seed cell; otherwise decrement it. The counter cell address is the live-in
 * that the surface-timer step passes.
 */
import { TWOPLAYER_FRAME_CELL_8146 } from "./names.js";

export function stepDiveFrameCounter(m, counter = m.regs.hl) {
  const { mem8 } = m;
  if (mem8[counter] === 0) {
    mem8[counter] = mem8[TWOPLAYER_FRAME_CELL_8146]; // drained -> reload from the seed cell
    return;
  }
  mem8[counter] = mem8[counter] - 1;
}
