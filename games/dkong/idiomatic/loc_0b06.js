// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0b06 — one step of the opening Kong-climb cutscene's display-list build, run once per
 * frame while cutscene step 4 is active.
 *
 * Runs at half rate (returns on odd frames). On even frames it follows a walk pointer into a
 * record table: a non-terminator byte is a signed Y delta added across all ten sprite-object
 * records, then return. The terminator finalizes the beat — load the next template, copy 8
 * header bytes, reposition the row, scroll the climb graphic to its target, assert the sound,
 * draw the board layout, stamp two video cells, arm the phase timer, advance the cutscene step
 * and point the gated sequence-advance at it.
 *
 * LIVE-OUT: memory-only — on the walk arm the walk pointer and the sprite-object Y column; on
 * the terminal arm the sprite-object block and buffer header, the scrolled climb graphic, the
 * sound latch, the drawn playfield, two video cells, the cutscene band count, the phase timer,
 * the incremented cutscene step and the sequence-advance pointer.
 */

import {
  CUTSCENE_BAND_COUNT,
  FRAME,
  INTRO_BEAT_LAYOUT_TABLE,
  INTRO_SCROLL_INDEX,
  INTRO_STEP,
  INTRO_WALK_PTR_A,
  SEQ_ADVANCE_PTR,
  SND_TRIGGER,
  SPRITE_BUFFER,
  SPRITE_OBJ_BLOCK,
  SUBSTATE_TIMER,
} from "./names.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";
import { scrollClimbGraphicStep } from "./scrollClimbGraphicStep.js";
import { drawBoardLayout } from "./drawBoardLayout.js";

const DISPLAY_Y_CELL = SPRITE_OBJ_BLOCK + 3; // the Y column of the sprite-object records
const WALK_TERMINATOR = 0x7f;
const SOUND_LATCH = SND_TRIGGER + 2; // three-frame audio-assert latch
const PROP_TEMPLATE = 0x385c;
const VIDEO_CELL_A = 0x74aa;
const VIDEO_CELL_B = 0x748a;

export function loc_0b06(m) {
  const { regs, mem8, mem16 } = m;

  // Parity idle: odd frames return immediately, halving the walk rate.
  if (mem8[FRAME] & 0x01) return;

  const ptr = mem16[INTRO_WALK_PTR_A];
  const byte = mem8[ptr];

  if (byte !== WALK_TERMINATOR) {
    // Advance the pointer and add the byte, taken as signed, into the sprite-object Y column.
    mem16[INTRO_WALK_PTR_A] = (ptr + 1);
    regs.hl = DISPLAY_Y_CELL;
    regs.c = byte;
    addToSpriteObjectColumn(m);
    return;
  }

  // -- terminator: finalize this cutscene beat --

  // Load the next template. The load leaves the source pointer at the template's end, and the
  // copy below chains off it rather than reloading.
  loadSpriteObjectBlock(m, PROP_TEMPLATE);

  // Copy 8 more bytes from the template's end into the sprite-buffer header.
  let src = regs.hl;
  let dst = SPRITE_BUFFER;
  for (let i = 0; i < 8; i++) {
    mem8[dst] = mem8[src];
    src = (src + 1) & 0xffff;
    dst = (dst + 1) & 0xffff;
  }

  // Reposition the fresh row: +0x50 on the X column and −4 on the Y column.
  regs.hl = SPRITE_OBJ_BLOCK;
  regs.c = 0x50;
  addToSpriteObjectColumn(m);
  regs.hl = DISPLAY_Y_CELL;
  regs.c = 0xfc; // -4
  addToSpriteObjectColumn(m);

  // Scroll the climb graphic up until its loop counter reaches 10 (synchronous run to target).
  do {
    scrollClimbGraphicStep(m);
  } while (mem8[INTRO_SCROLL_INDEX] !== 0x0a);

  // Assert the beat's sound for three frames, then draw the board-layout segment table.
  mem8[SOUND_LATCH] = 0x03;
  regs.de = INTRO_BEAT_LAYOUT_TABLE;
  drawBoardLayout(m);

  // Terminal-beat epilogue.
  mem8[VIDEO_CELL_A] = 0x10;
  mem8[VIDEO_CELL_B] = 0x10;
  mem8[CUTSCENE_BAND_COUNT] = 0x05;
  mem8[SUBSTATE_TIMER] = 0x20; // arm the 32-frame phase countdown
  mem8[INTRO_STEP] = (mem8[INTRO_STEP] + 1);
  mem16[SEQ_ADVANCE_PTR] = INTRO_STEP;
}
