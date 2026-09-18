// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1880 — one step of the between-boards interlude. Each frame it slides the ten-record
 * sprite-object block down one pixel (+1 into the Y column of all ten records). On the single
 * frame record 4's Y hits the landing row exactly, it builds the next scene once — arrival sprite
 * code, staged object record, 70-tile fill, board layout draw, sprite-buffer drop, pace-counter
 * reset, sound latch, step-selector advance — then the following frames dispatch the next step.
 * The landing test is exact equality after the nudge, so the scene builds on exactly one frame.
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
  const { regs, mem8 } = m;

  regs.hl = Y_COLUMN;
  regs.c = DESCEND_STEP;
  addToSpriteObjectColumn(m);

  if (mem8[GATE_Y] !== LANDED_Y) return;

  mem8[REC4_CODE] = REC4_CODE_VALUE;

  mem8[OBJ_RECORD + 0] = 0x7f;
  mem8[OBJ_RECORD + 1] = 0x39;
  mem8[OBJ_RECORD + 2] = 0x01;
  mem8[OBJ_RECORD + 3] = 0xd8;

  regs.hl = TILE_FILL_DST; // the fill start, read live-in by the fill
  loc_1826(m);

  regs.de = SEGMENT_TABLE; // the table base, read live-in by the draw
  drawBoardLayout(m);

  addStrided(m, SPRITE_BUF_Y_SHIFT, SPRITE_BUF_STRIDE, SPRITE_BUF_COUNT, SPRITE_BUF_Y);

  mem8[PACE_COUNTER] = 0x00;
  mem8[SND_LATCH] = SND_ASSERT_FRAMES;
  mem8[BOARD_ADVANCE_STEP] = (mem8[BOARD_ADVANCE_STEP] + 1);
}
