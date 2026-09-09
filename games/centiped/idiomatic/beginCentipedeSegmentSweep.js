// SPDX-License-Identifier: GPL-3.0-only
import { loc_00, loc_87, SFX_TIMER_CH2 } from "./names.js";
import { moveCentipedeSegment } from "./moveCentipedeSegment.js";

/**
 * beginCentipedeSegmentSweep — the per-frame entry into the centipede segment walk. While the $87
 * gate is set the whole sweep is skipped. Otherwise it seeds the segment index at the last slot
 * (0x0b) and, on frames whose low nibble of $00 is zero, arms the ch2 SFX timer to 7, then drops
 * into the per-segment mover — which recurses back down the slots as it decrements the index. [code]
 */
export function beginCentipedeSegmentSweep(m) {
  const { mem8 } = m;
  if (mem8[loc_87] !== 0) return; // gated off -> return
  if ((mem8[loc_00] & 0x0f) === 0) mem8[SFX_TIMER_CH2] = 0x07;
  // seed the sweep at the last segment slot and enter the mover
  return (m.regs.x = 0x0b), moveCentipedeSegment(m);
}
