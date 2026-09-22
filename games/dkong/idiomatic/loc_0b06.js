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

import { u16 } from "../../../core/int.js";
import {
  CUTSCENE_BAND_COUNT,
  FRAME,
  INTRO_BEAT_LAYOUT_TABLE,
  INTRO_SCROLL_INDEX,
  INTRO_STEP,
  INTRO_WALK_PTR_A,
  SEQ_ADVANCE_PTR,
  SND_TRIGGER,
  SPRITE_BASE_FIGURE_ROM,
  SPRITE_BUFFER,
  SPRITE_OBJ_BLOCK,
  SUBSTATE_TIMER,
  loc_748a,
  loc_74aa,
} from "./names.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { addStrided } from "./addStrided.js";
import { scrollClimbGraphicStep } from "./scrollClimbGraphicStep.js";
import { drawBoardLayout } from "./drawBoardLayout.js";

const DISPLAY_Y_CELL = SPRITE_OBJ_BLOCK + 3; // the Y column of the sprite-object records
const WALK_TERMINATOR = 0x7f;
const SOUND_LATCH = SND_TRIGGER + 2; // three-frame audio-assert latch
const OBJ_BLOCK_BYTES = 0x28; // loadSpriteObjectBlock copies this many, advancing its source
const OBJ_COLUMN_STRIDE = 4; // one sprite-object record
const OBJ_COLUMN_COUNT = 0x0a; // ten records — the fixed sprite-object column shape
const VIDEO_CELL_A = loc_74aa;
const VIDEO_CELL_B = loc_748a;

export function loc_0b06(m) {
  const { mem8, mem16 } = m;

  // Parity idle: odd frames return immediately, halving the walk rate.
  if (mem8[FRAME] & 0x01) return;

  const ptr = mem16[INTRO_WALK_PTR_A];
  const byte = mem8[ptr];

  if (byte !== WALK_TERMINATOR) {
    // Advance the pointer and add the byte, taken as signed, into the sprite-object Y column.
    mem16[INTRO_WALK_PTR_A] = (ptr + 1);
    addStrided(m, byte, OBJ_COLUMN_STRIDE, OBJ_COLUMN_COUNT, DISPLAY_Y_CELL);
    return;
  }

  // -- terminator: finalize this cutscene beat --

  // Load the next template. The load leaves the source pointer at the template's end, and the
  // copy below chains off it rather than reloading.
  loadSpriteObjectBlock(m, SPRITE_BASE_FIGURE_ROM);

  // Copy 8 more bytes from the template's end into the sprite-buffer header. The loader left its
  // source pointer advanced past the 0x28 bytes it copied; the copy chains off that.
  let src = u16(SPRITE_BASE_FIGURE_ROM + OBJ_BLOCK_BYTES);
  let dst = SPRITE_BUFFER;
  for (let i = 0; i < 8; i++) {
    mem8[dst] = mem8[src];
    src = u16(src + 1);
    dst = u16(dst + 1);
  }

  // Reposition the fresh row: +0x50 on the X column and −4 on the Y column.
  addStrided(m, 0x50, OBJ_COLUMN_STRIDE, OBJ_COLUMN_COUNT, SPRITE_OBJ_BLOCK);
  addStrided(m, 0xfc, OBJ_COLUMN_STRIDE, OBJ_COLUMN_COUNT, DISPLAY_Y_CELL); // -4

  // Scroll the climb graphic up until its loop counter reaches 10 (synchronous run to target).
  do {
    scrollClimbGraphicStep(m);
  } while (mem8[INTRO_SCROLL_INDEX] !== 0x0a);

  // Assert the beat's sound for three frames, then draw the board-layout segment table.
  mem8[SOUND_LATCH] = 0x03;
  drawBoardLayout(m, undefined, INTRO_BEAT_LAYOUT_TABLE); // sp keeps its default; de = the table

  // Terminal-beat epilogue.
  mem8[VIDEO_CELL_A] = 0x10;
  mem8[VIDEO_CELL_B] = 0x10;
  mem8[CUTSCENE_BAND_COUNT] = 0x05;
  mem8[SUBSTATE_TIMER] = 0x20; // arm the 32-frame phase countdown
  mem8[INTRO_STEP] = (mem8[INTRO_STEP] + 1);
  mem16[SEQ_ADVANCE_PTR] = INTRO_STEP;
}
