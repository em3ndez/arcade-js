// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1d95 — commit the accumulator into ITEM_COLLECTED, then (off 25m) queue a 3-frame
 * priority sound.
 *
 * A short conditional-call target in the item-collection subsystem. Both sites that reach it
 * do so immediately after a prize/item pickup has raised the collection flags, and both arrive
 * with the accumulator at zero — so in play the store CLEARS ITEM_COLLECTED. The routine
 * itself stores whatever it is handed.
 *
 * After committing the flag it reads BOARD: on 25m it stops, because 25m plays no pickup
 * sound. On every other board it queues priority tune 13 for 3 frames — the priority channel
 * overrides the background music while its frame count is nonzero. A LEAF: it calls nothing.
 *
 * WHAT THIS DOES NOT CLAIM: which prize the collection flag stands for, or which tune the
 * priority slot plays. The mechanics — store the byte, then gate the sound on the board — are
 * what is established.
 *
 * LIVE-OUT: memory-only — ITEM_COLLECTED and, off 25m, the priority-sound slot and its frame
 * count.
 */
import { ITEM_COLLECTED, BOARD, SND_PRIORITY, SND_PRIORITY_FRAMES } from "./names.js";

export function loc_1d95(m) {
  const { regs, mem } = m;

  // Commit the accumulator into ITEM_COLLECTED (both callers hand over a 0, so in play this
  // CLEARS it; the routine stores whatever it holds).
  mem.write8(ITEM_COLLECTED, regs.a & 0xff);

  // On 25m stop here: that board plays no pickup sound.
  if (mem.read8(BOARD) === 1) return;

  // Off 25m: queue priority tune 13 for 3 frames (it overrides the background music while
  // the frame counter is nonzero).
  mem.write8(SND_PRIORITY, 0x0d);
  mem.write8(SND_PRIORITY_FRAMES, 0x03);
}
