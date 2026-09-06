// SPDX-License-Identifier: GPL-3.0-only
// Sequence-state handler: run the shared strided-table reset, then tick a two-tier dwell (low tier
// the low tier, mid tier). Each tier holds until it expires. On the low tier's expiry it reloads
// and queues a command word tracking the mid count. On the mid tier's expiry it advances the sequence
// state, reloads both tiers, clears the sprite-source block, and clears the redraw count.
import { clearStridedTable } from "./clearStridedTable.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import { fillMemoryBlock } from "./fillMemoryBlock.js";
import { loc_4008, loc_4009, SEQUENCE_STATE, SPRITE_SOURCE_OBJ_BASE, DRAWN_COLUMN_COUNT } from "./names.js";

export function emitMessageColumnsThenAdvanceSequence(m) {
  const { mem8 } = m;

  clearStridedTable(m);

  // Low-tier countdown: hold until it expires.
  const low = (mem8[loc_4008] - 1) & 0xff;
  mem8[loc_4008] = low;
  if (low !== 0) return;

  // Low tier expired: reload it and queue a command word whose low byte tracks the mid count.
  mem8[loc_4008] = 80;
  const midCount = mem8[loc_4009];
  enqueueCommandWord(m, (6 << 8) | ((midCount + 6) & 0xff), loc_4009);

  // Mid-tier countdown: hold until it expires.
  const mid = (mem8[loc_4009] - 1) & 0xff;
  mem8[loc_4009] = mid;
  if (mid !== 0) return;

  // Mid tier expired: advance the state, reload both tiers, clear the block + redraw count.
  mem8[SEQUENCE_STATE] = mem8[SEQUENCE_STATE] + 1;
  mem8[loc_4008] = 32;
  mem8[loc_4009] = 4;
  fillMemoryBlock(m, SPRITE_SOURCE_OBJ_BASE, 0, 0); // count 0 -> full 256-byte clear
  mem8[DRAWN_COLUMN_COUNT] = 0;
}
