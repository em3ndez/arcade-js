// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1880 — one step of the interlude that plays between boards: slide the ten-record
 * sprite-object block down the screen a pixel a frame, and on the one frame it lands,
 * build the next scene and hand the sequence on to the step after this one.
 *
 * Every frame it runs it first nudges the whole block down one pixel — a +1 added into
 * field +3, the Y column, of all ten records — and then forks on whether the block has
 * finished descending:
 *
 *   - DESCENDING — record 4's Y has not reached the landing row. Return, and slide again
 *     next frame. This is the common arm, and it is the whole cost of most frames here.
 *   - LANDED — record 4's Y is exactly the landing row. Build the next scene, once:
 *       * record 4 takes its arrival sprite code;
 *       * a four-byte object record is staged;
 *       * a 5×14 = 70-tile block is filled with one tile, descending from the fill target;
 *       * the board's girder-and-ladder layout is drawn from its line-segment table;
 *       * sprite-buffer records 0 and 1 drop 0x28 pixels;
 *       * the pace counter that the FOLLOWING step counts down is reset to 0;
 *       * sound latch 2 is asserted for three frames;
 *       * the step selector is incremented, so the next frame dispatches the next step.
 *
 * The landing test is exact equality, not a threshold, and the +1 nudge happens before it,
 * so the block passes through the landing row on exactly one frame and the scene is built
 * exactly once. Larger Y is LOWER on this screen, so the landing row is near the bottom of
 * a 256-row frame and the block is sliding downward, not up.
 *
 * The name is kept address-shaped deliberately: the mechanics are precise, but which
 * picture this scene is — what the tiles and segments draw — is not settled by anything in
 * this file.
 *
 * Reads: record 4's Y; the step selector.
 * Writes: the Y column of all ten sprite-object records; record 4's sprite code; the staged
 * object record; the 70-tile block and whatever tiles the layout draw stamps; the Y field of
 * sprite-buffer records 0 and 1; the pace counter; the sound latch; the step selector.
 *
 * LIVE-OUT: memory-only.
 */

import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";
import { addStrided } from "./addStrided.js";
import { drawBoardLayout } from "./drawBoardLayout.js";
import { loc_1826 } from "../translated/loc_1826.js";
import { SPRITE_OBJ_BLOCK, SPRITE_BUFFER, SND_TRIGGER, BOARD_ADVANCE_STEP } from "./names.js";

const Y_COLUMN = SPRITE_OBJ_BLOCK + 3; // field +3 (Y) of sprite-object record 0
const DESCEND_STEP = 0x01; // +1 into the Y column each frame (slide the block down)
const GATE_Y = SPRITE_OBJ_BLOCK + 0x13; // record 4's Y byte — the descent gate
const LANDED_Y = 0xd0; // the Y at which the block has finished descending

const REC4_CODE = SPRITE_OBJ_BLOCK + 0x11; // record 4's sprite-code byte
const REC4_CODE_VALUE = 0x20;

const OBJ_RECORD = 0x6a24; // the staged 4-byte object record

const TILE_FILL_DST = 0x76c6; // start of the 5×14 descending tile fill
const SEGMENT_TABLE = 0x3a5f; // this scene's line-segment table

const SPRITE_BUF_Y = SPRITE_BUFFER + 3; // field +3 (Y) of sprite-buffer record 0
const SPRITE_BUF_STRIDE = 0x04; // one 4-byte sprite record
const SPRITE_BUF_COUNT = 0x02; // records 0 and 1
const SPRITE_BUF_Y_SHIFT = 0x28; // move those two records down 0x28 px

const PACE_COUNTER = 0x62af; // per-frame counter the following step counts back down
const SND_LATCH = SND_TRIGGER + 2; // sound latch 2
const SND_ASSERT_FRAMES = 0x03; // held asserted for three frames, then counted down elsewhere

export function loc_1880(m) {
  const { regs, mem } = m;

  // Slide the whole ten-record sprite-object block down one pixel — add +1 into field +3
  // (the Y column) of all ten records, stride 4.
  regs.hl = Y_COLUMN;
  regs.c = DESCEND_STEP;
  addToSpriteObjectColumn(m);

  // Hold here until record 4's Y is exactly the landing row; until then, just keep sliding.
  if (mem.read8(GATE_Y) !== LANDED_Y) return;

  // Landed — build the next scene, once.

  // Record 4's arrival sprite code.
  mem.write8(REC4_CODE, REC4_CODE_VALUE);

  // Stage the four-byte object record.
  mem.write8(OBJ_RECORD + 0, 0x7f);
  mem.write8(OBJ_RECORD + 1, 0x39);
  mem.write8(OBJ_RECORD + 2, 0x01);
  mem.write8(OBJ_RECORD + 3, 0xd8);

  // Fill a 5×14 = 70-tile block, descending from the fill target.
  regs.hl = TILE_FILL_DST; // the fill start, read live-in by the fill
  loc_1826(m);

  // Draw the board's girder-and-ladder layout from its line-segment table.
  regs.de = SEGMENT_TABLE; // the table base, read live-in by the draw
  drawBoardLayout(m);

  // Add +0x28 into field +3 (Y) of sprite-buffer records 0 and 1, stride 4 — shift those
  // two records down 0x28 pixels.
  regs.hl = SPRITE_BUF_Y;
  regs.de = SPRITE_BUF_STRIDE; // 4
  regs.b = SPRITE_BUF_COUNT; // 2 records
  regs.c = SPRITE_BUF_Y_SHIFT; // +0x28
  addStrided(m);

  // Reset the pace counter the following step counts down, assert the sound latch, and
  // advance the step selector so the next frame dispatches the next step.
  mem.write8(PACE_COUNTER, 0x00);
  mem.write8(SND_LATCH, SND_ASSERT_FRAMES);
  mem.write8(BOARD_ADVANCE_STEP, (mem.read8(BOARD_ADVANCE_STEP) + 1) & 0xff);
}
