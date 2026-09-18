// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0b68 — step 6 of the opening Kong-climb cutscene: every other frame, scroll the
 * sprite-object block diagonally; on each wrap of the scroll path, stamp the next board band,
 * and advance the cutscene once all bands are placed.
 *
 * LIVE-OUT: memory-only.
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

// Nibble swap — acts as ×16 for the small band count; a full rotate, faithful for every input.
const nibbleSwap = (v) => (((v << 4) | (v >> 4)) & 0xff);

// Add `c` into ten stride-4 bytes from `hl`; staged in the register file, which addStrided reads.
function strideAddTen(m, hl, c) {
  addStrided(m, c, 0x0004, 0x0a, hl);
}

export function loc_0b68(m) {
  const { mem8, mem16, regs } = m;

  if (mem8[FRAME] & 0x01) return;

  const cursor = mem16[INTRO_WALK_PTR_B];
  const delta = mem8[cursor];

  if (delta !== SENTINEL) {
    // Diagonal scroll: Y += signed delta, X -= 1 across all ten records.
    mem16[INTRO_WALK_PTR_B] = (cursor + 1);
    strideAddTen(m, OBJ_Y, delta);
    strideAddTen(m, OBJ_X, 0xff);
    return;
  }

  // Path wrapped: rewind the cursor and trigger the stamp sound.
  mem16[INTRO_WALK_PTR_B] = SCROLL_TABLE;
  mem8[SND_TRIGGER + 2] = 0x03; // a 3-frame sound assert

  const bandIdx = nibbleSwap((mem8[CUTSCENE_BAND_COUNT] - 1) & 0xff);
  regs.de = (BAND_TABLE + bandIdx) & 0xffff;
  drawBoardLayout(m);

  const bandsLeft = (mem8[CUTSCENE_BAND_COUNT] - 1) & 0xff;
  mem8[CUTSCENE_BAND_COUNT] = bandsLeft;
  if (bandsLeft !== 0) return;

  mem8[SUBSTATE_TIMER] = 0xb0; // 176-frame hold
  mem8[INTRO_STEP] = (mem8[INTRO_STEP] + 1);
}
