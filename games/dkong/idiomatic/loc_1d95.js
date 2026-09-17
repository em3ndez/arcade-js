// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1d95 — commit the accumulator into ITEM_COLLECTED (both callers hand over 0, so in play
 * this clears it), then on 25m stop (no pickup sound) and on every other board queue priority
 * tune 13 for 3 frames.
 *
 * LIVE-OUT: memory-only — ITEM_COLLECTED and, off 25m, the priority-sound slot and its frame
 * count.
 */
import { ITEM_COLLECTED, BOARD, SND_PRIORITY, SND_PRIORITY_FRAMES } from "./names.js";

export function loc_1d95(m) {
  const { regs, mem8 } = m;

  mem8[ITEM_COLLECTED] = regs.a & 0xff;

  if (mem8[BOARD] === 1) return;

  mem8[SND_PRIORITY] = 0x0d;
  mem8[SND_PRIORITY_FRAMES] = 0x03;
}
