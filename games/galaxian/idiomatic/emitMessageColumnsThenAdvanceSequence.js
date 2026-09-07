// SPDX-License-Identifier: GPL-3.0-only
/**
 * emitMessageColumnsThenAdvanceSequence — an attract step that paces out the title/message text.
 *
 * WHAT IT IS
 *   A sequence-state handler that runs a two-tier dwell and, on each low-tier expiry, queues one more
 *   text column to be drawn — so the attract message paints in column by column at a steady cadence
 *   before the sequence moves on.
 *
 * ROLE IN THE MACHINE
 *   RST-28 dispatch target: SEQUENCE_STATE index 4 of the attract loop
 *   (runAttractSequenceAndAdvanceOnCredit's table @0x0164). It runs the shared strided-table reset, then
 *   ticks a two-tier dwell held in loc_4008 (low/prescaler tier) and loc_4009 (mid tier). The low tier
 *   holds most frames; on each low-tier expiry it reloads to 80 and enqueues a channel-6 renderMessageColumn
 *   command whose column index tracks the mid count (mid + 6). Only on the low-tier expiry does it also tick
 *   the mid tier; on the mid tier's own expiry it advances SEQUENCE_STATE (0x400a), reloads both tiers
 *   (32 / 4), clears the sprite-source object block SPRITE_SOURCE_OBJ_BASE (0x42b0), and clears the redraw
 *   count DRAWN_COLUMN_COUNT (0x4241).
 *
 * ROM 0x0218.  Grounding: [seen].
 *
 * LIVE-OUT: loc_4008/loc_4009 dwell tiers; a queued command word; on full expiry SEQUENCE_STATE bumped and
 *   the sprite-source block + DRAWN_COLUMN_COUNT cleared.
 */
import { clearStridedTable } from "./clearStridedTable.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import { fillMemoryBlock } from "./fillMemoryBlock.js";
import { loc_4008, loc_4009, SEQUENCE_STATE, SPRITE_SOURCE_OBJ_BASE, DRAWN_COLUMN_COUNT } from "./names.js";

export function emitMessageColumnsThenAdvanceSequence(m) {
  const { mem8 } = m;

  // Shared per-sub-state reset of the strided work table.
  clearStridedTable(m);

  // Low/prescaler tier: decrement it; while it is still nonzero the step just holds this frame.
  const low = (mem8[loc_4008] - 1) & 0xff;
  mem8[loc_4008] = low;
  if (low !== 0) return;

  // Low tier expired: reload it to 80 and queue a channel-6 render-message-column command whose low byte
  // is the current mid count plus 6 (which column of the message to paint next).
  mem8[loc_4008] = 80;
  const midCount = mem8[loc_4009];
  enqueueCommandWord(m, (6 << 8) | ((midCount + 6) & 0xff), loc_4009);

  // Mid tier only advances on a low-tier expiry: decrement it, and while it is nonzero hold here.
  const mid = (mem8[loc_4009] - 1) & 0xff;
  mem8[loc_4009] = mid;
  if (mid !== 0) return;

  // Mid tier expired: advance the sequence state, reload both dwell tiers (32 / 4), wipe the sprite-source
  // object block, and reset the drawn-column count so the next state starts clean.
  mem8[SEQUENCE_STATE] = mem8[SEQUENCE_STATE] + 1;
  mem8[loc_4008] = 32;
  mem8[loc_4009] = 4;
  fillMemoryBlock(m, SPRITE_SOURCE_OBJ_BASE, 0, 0); // count 0 -> full 256-byte clear
  mem8[DRAWN_COLUMN_COUNT] = 0;
}
