// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0b68 — step 6 of the opening Kong-climb cutscene: scroll the sprite-object block
 * diagonally each frame and, every time the scroll path repeats, stamp the next board band;
 * advance the cutscene once all bands are placed.
 *
 * The opening Kong-climb cutscene is the short intro at the head of every board. Its step
 * index INTRO_STEP walks 0..7, one handler per step, dispatched every frame; this is the
 * handler for step 6. It is re-dispatched every frame while the step index holds, and per
 * frame:
 *
 *   - Gate on even frames only: return if FRAME's bit 0 is set, so the scroll advances every
 *     other frame.
 *   - Read the next signed Y-delta through the walk cursor INTRO_WALK_PTR_B. Then:
 *       · an ordinary delta (the common case): advance the cursor one byte and scroll all ten
 *         records of SPRITE_OBJ_BLOCK one step — every record's Y column gains the signed
 *         delta and every record's X column loses one — as a pair of strided adds over the
 *         ten-record, stride-4 block. Return.
 *       · the sentinel (the path wrapped): loop the cursor back to the table start, trigger a
 *         3-frame sound assert, and draw the next board band. The band's record address is the
 *         band table plus the remaining band count minus one, scaled by 16, handed to the
 *         layout walk, which draws that band's girders and ladders. Then decrement
 *         CUTSCENE_BAND_COUNT; while it is still non-zero, return — more bands go down on
 *         later wraps.
 *   - When the band count reaches 0 the scene is complete: arm SUBSTATE_TIMER for a metered
 *     176-frame hold and step INTRO_STEP on, so the next frame dispatches the final beat.
 *
 * WHAT THIS DOES NOT CLAIM: which sprites the block holds at this step — an earlier step
 * reloads it with a fresh template, so a reading taken before that does not carry forward —
 * nor whether the segments drawn here are specifically girders rather than generic board line
 * segments.
 *
 * LIVE-OUT: memory-only. The dispatcher discards this handler's return and reads no register
 * or flag it leaves.
 */

import { addStrided } from "./addStrided.js"; // add a value into N bytes at a fixed stride
import { drawBoardLayout } from "./drawBoardLayout.js"; // walk a board-layout segment table and draw it
import {
  FRAME,
  SUBSTATE_TIMER,
  INTRO_STEP,
  SND_TRIGGER,
  SPRITE_OBJ_BLOCK,
  INTRO_WALK_PTR_B,
  CUTSCENE_BAND_COUNT,
} from "./names.js";

const SCROLL_TABLE = 0x38cb; // base of the per-step signed-Y-delta table
const BAND_TABLE = 0x38dc; // base of the 16-byte-strided band-record table
const SENTINEL = 0x7f; // table byte meaning "path wrapped"

const OBJ_X = SPRITE_OBJ_BLOCK; // record 0's X byte — the start of the stride-4 X column
const OBJ_Y = SPRITE_OBJ_BLOCK + 3; // record 0's Y byte — the start of the stride-4 Y column

// A nibble swap, which for the small band count is a multiply by 16. The rotate is faithful
// for every input, not just counts below 16.
const nibbleSwap = (v) => (((v << 4) | (v >> 4)) & 0xff);

// Add a value into each of the ten stride-4 bytes starting at a pointer. The strided add reads
// its parameters out of the register file, so they are staged here.
function strideAddTen(m, hl, c) {
  const { regs } = m;
  regs.hl = hl;
  regs.c = c;
  regs.de = 0x0004; // the stride
  regs.b = 0x0a; // ten bytes
  addStrided(m);
}

export function loc_0b68(m) {
  const { mem, regs } = m;

  // Advance only on even frames.
  if (mem.read8(FRAME) & 0x01) return;

  // Read the next Y-delta through the walk cursor.
  const cursor = mem.read16(INTRO_WALK_PTR_B);
  const delta = mem.read8(cursor);

  if (delta !== SENTINEL) {
    // Diagonal scroll: advance the cursor, then nudge every record's Y by the signed delta
    // and its X left by one, each a stride-4 add over the ten-record block.
    mem.write16(INTRO_WALK_PTR_B, (cursor + 1) & 0xffff);
    strideAddTen(m, OBJ_Y, delta);
    strideAddTen(m, OBJ_X, 0xff);
    return;
  }

  // The sentinel: the scroll path wrapped. Loop the cursor back to the table start and trigger
  // the stamp sound.
  mem.write16(INTRO_WALK_PTR_B, SCROLL_TABLE);
  mem.write8(SND_TRIGGER + 2, 0x03); // a 3-frame sound assert

  // Draw the next board band, at the band table plus the scaled remaining count minus one. The
  // layout walk reads that record-table pointer out of the register file.
  const bandIdx = nibbleSwap((mem.read8(CUTSCENE_BAND_COUNT) - 1) & 0xff);
  regs.de = (BAND_TABLE + bandIdx) & 0xffff;
  drawBoardLayout(m);

  // One band placed; stay in this step until the count drains.
  const bandsLeft = (mem.read8(CUTSCENE_BAND_COUNT) - 1) & 0xff;
  mem.write8(CUTSCENE_BAND_COUNT, bandsLeft);
  if (bandsLeft !== 0) return;

  // All bands placed: arm the metered hold and advance the cutscene to its final beat.
  mem.write8(SUBSTATE_TIMER, 0xb0); // 176-frame hold
  mem.write8(INTRO_STEP, (mem.read8(INTRO_STEP) + 1) & 0xff);
}
