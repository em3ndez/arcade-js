// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0b06 — one step of the opening Kong-climb cutscene's display-list build, run once per frame
 * while cutscene step 4 is active.
 *
 * Each frame it does one of three things, chosen by the data it is walking:
 *
 *   A — PARITY IDLE. On odd frames it returns at once, so the build advances at half rate: one
 *       table byte every other frame.
 *   B — WALK ONE TABLE BYTE. On even frames, follow the walk pointer into a record table and read
 *       the next byte. If it is not the terminator, advance the pointer and add that byte, taken
 *       as signed, into the Y column of all ten sprite-object records, then return. This is how
 *       the cutscene props are shifted into place, one delta per frame.
 *   C — TERMINATOR -> FINALIZE THE BEAT. When the byte is the terminator the walk is done, so:
 *         - load the next sprite-object template into the sprite-object block,
 *         - copy 8 more bytes from that template's end into the sprite buffer's header,
 *         - reposition the fresh row: +0x50 on the X column, -4 on the Y column,
 *         - scroll the climb graphic up until its loop counter reaches 10,
 *         - assert the beat's sound for three frames,
 *         - draw the board-layout segment table,
 *         - stamp two video cells and set the cutscene band count to 5,
 *         - arm the 32-frame phase timer,
 *         - advance the cutscene step, and point the gated sequence-advance at that step counter.
 *
 * The four helpers this step drives still take their inputs in machine registers, so the register
 * file is loaded at each of those call boundaries; nothing else here uses it.
 *
 * LIVE-OUT: memory-only — on the walk arm the walk pointer and the sprite-object Y column; on the
 * terminal arm the sprite-object block and buffer header, the scrolled climb graphic, the sound
 * latch, the drawn playfield, two video cells, the cutscene band count, the phase timer, the
 * incremented cutscene step and the sequence-advance pointer.
 */

import {
  FRAME,
  SUBSTATE_TIMER,
  INTRO_STEP,
  SEQ_ADVANCE_PTR,
  SPRITE_OBJ_BLOCK,
  SPRITE_BUFFER,
  SND_TRIGGER,
  INTRO_WALK_PTR_A,
  CUTSCENE_BAND_COUNT,
  INTRO_SCROLL_INDEX,
} from "./names.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";
import { scrollClimbGraphicStep } from "./scrollClimbGraphicStep.js";
import { drawBoardLayout } from "./drawBoardLayout.js";

const DISPLAY_Y_CELL = SPRITE_OBJ_BLOCK + 3; // the Y column of the sprite-object records
const WALK_TERMINATOR = 0x7f; // sentinel byte that ends the walk -> terminal setup
const SOUND_LATCH = SND_TRIGGER + 2; // three-frame audio-assert latch for the beat
const PROP_TEMPLATE = 0x385c; // sprite-object template loaded on the terminal beat
const LAYOUT_TABLE = 0x392c; // board-layout segment table drawn on the terminal beat
const VIDEO_CELL_A = 0x74aa; // video cell stamped on the terminal beat
const VIDEO_CELL_B = 0x748a; // video cell stamped on the terminal beat

export function loc_0b06(m) {
  const { regs, mem } = m;

  // -- PATH A: parity idle. Odd frames return immediately, halving the walk rate so the
  // cutscene builds at the intended speed.
  if (mem.read8(FRAME) & 0x01) return;

  // Follow the walk pointer into the record table and read the next byte.
  const ptr = mem.read16(INTRO_WALK_PTR_A);
  const byte = mem.read8(ptr);

  if (byte !== WALK_TERMINATOR) {
    // -- PATH B: walk one non-sentinel byte. Advance the pointer and add the byte, taken as
    // signed, into the Y column of all ten sprite-object records.
    mem.write16(INTRO_WALK_PTR_A, (ptr + 1) & 0xffff);
    regs.hl = DISPLAY_Y_CELL; // which column the add walks
    regs.c = byte; // the signed delta
    addToSpriteObjectColumn(m);
    return;
  }

  // -- PATH C: the terminator -> finalize this cutscene beat. --

  // Load the next sprite-object template into the sprite-object block. The block load leaves the
  // source pointer at the template's end, and the copy below deliberately chains off it rather
  // than reloading.
  regs.hl = PROP_TEMPLATE;
  loadSpriteObjectBlock(m);

  // Copy 8 more bytes from the template's end into the 8-byte sprite-buffer header that sits just
  // below the sprite-object block.
  let src = regs.hl; // left at the template's end by the block load
  let dst = SPRITE_BUFFER;
  for (let i = 0; i < 8; i++) {
    mem.write8(dst, mem.read8(src));
    src = (src + 1) & 0xffff;
    dst = (dst + 1) & 0xffff;
  }

  // Reposition the freshly-loaded row: +0x50 on the X column and -4 on the Y column, each
  // applied across all ten records.
  regs.hl = SPRITE_OBJ_BLOCK; // the X column
  regs.c = 0x50;
  addToSpriteObjectColumn(m);
  regs.hl = DISPLAY_Y_CELL; // the Y column
  regs.c = 0xfc; // -4
  addToSpriteObjectColumn(m);

  // Scroll the climb graphic up until its loop counter reaches 10. Each pass steps that counter
  // down, so this is a synchronous run to a fixed target rather than a per-frame animation.
  do {
    scrollClimbGraphicStep(m);
  } while (mem.read8(INTRO_SCROLL_INDEX) !== 0x0a);

  // Assert the beat's sound for three frames, then draw the board-layout segment table.
  mem.write8(SOUND_LATCH, 0x03);
  regs.de = LAYOUT_TABLE; // the segment table the layout draw reads
  drawBoardLayout(m);

  // Terminal-beat epilogue: stamp two video cells, set the cutscene band count, arm the
  // 32-frame phase timer, advance the cutscene step, and point the gated sequence-advance at it.
  mem.write8(VIDEO_CELL_A, 0x10);
  mem.write8(VIDEO_CELL_B, 0x10);
  mem.write8(CUTSCENE_BAND_COUNT, 0x05);
  mem.write8(SUBSTATE_TIMER, 0x20); // arm the 32-frame phase countdown
  mem.write8(INTRO_STEP, (mem.read8(INTRO_STEP) + 1) & 0xff); // advance the step
  mem.write16(SEQ_ADVANCE_PTR, INTRO_STEP);
}
