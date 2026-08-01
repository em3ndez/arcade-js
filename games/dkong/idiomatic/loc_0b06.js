// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0b06 — one step of the opening Kong-climb cutscene's display-list build.  ROM 0x0b06.
 *
 * Step 4 of the opening cutscene (dispatched by dispatchIntroCutsceneStep / ROM 0x0A76
 * while GAME_SUBSTATE == 7 and INTRO_STEP == 4). It is called once per frame while that
 * step is active and does one of three things, chosen by data:
 *
 *   A — PARITY IDLE. `ld a,(FRAME) / rrca / ret c`: on odd frames it returns immediately,
 *       so the build advances at half rate (one table byte every other frame).
 *   B — WALK ONE TABLE BYTE. On even frames, follow the indirect walk pointer INTRO_WALK_PTR_A (0x63C2) into
 *       a ROM record table and read the next byte. If it is not the 0x7F terminator,
 *       advance the pointer and add that (signed) byte into the Y column of all ten
 *       sprite-object records via the rst-0x38 vector (addToSpriteObjectColumn), then
 *       return. This is how the cutscene props are shifted into place, one delta per frame.
 *   C — TERMINATOR -> FINALIZE THE BEAT. When the byte is 0x7F the walk is done, so:
 *         - load the next sprite-object template from ROM 0x385C into SPRITE_OBJ_BLOCK
 *           (loadSpriteObjectBlock leaves HL at the template's end, 0x3884),
 *         - copy 8 more bytes from that end pointer into SPRITE_BUFFER (0x6900) — the
 *           oracle does NOT reload HL; the copy chains off the block copy's end,
 *         - reposition the fresh row: +0x50 on the X column, -4 on the Y column,
 *         - scroll the climb graphic up until its loop counter INTRO_SCROLL_INDEX (0x638E) reaches 0x0A,
 *         - assert the beat's sound (a 3-frame latch at SND_TRIGGER+2 = 0x6082),
 *         - draw the board-layout segment table at ROM 0x392C (drawBoardLayout),
 *         - stamp two video-RAM cells, set the cutscene band count (CUTSCENE_BAND_COUNT 0x638D <- 5),
 *         - arm the 32-frame phase timer (SUBSTATE_TIMER <- 0x20),
 *         - advance the cutscene step (inc INTRO_STEP) and re-seed loc_3069's gated
 *           pointer SEQ_ADVANCE_PTR at INTRO_STEP.
 *
 * MEMORY IN / MEMORY OUT. loc_0b06 reads no register as a live-in (it writes A/HL before
 * ever reading them) and leaves no register a caller consumes — the dispatcher
 * (dispatchIntroCutsceneStep) discards the arm's return and branches on no flag it sets —
 * so the honest signature is `(m) -> void`, memory-only. Its four callees are all already
 * idiomatic; each still reads the Z80 register file for its inputs, so this routine sets
 * those registers at the call boundary (HL for the block copy, HL/C for the rst-0x38 adds,
 * DE for the layout draw; scrollClimbGraphicStep is memory-only). That register hand-off is
 * the one place the register file survives, per doc-06's boundary rule.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0b06.test.js.
 * GATE:     crafted-entry — a driven coin+start run reaches ALL THREE arms naturally in one
 *           intro (measured: 23 parity-idle / 22 walk-byte / 1 terminal over 46 dispatches),
 *           each replayed on a FRESH clone (this routine writes memory) against the oracle on
 *           RAM - STACK_SCRATCH; + crafted entries that force the walk-boundary byte and the
 *           terminal arm deterministically. Reached only in a credited game at INTRO_STEP==4;
 *           never in plain attract (0 dispatches / 2500 attract frames). Teeth: two twins.
 * LIVE-OUT: memory-only — the walk pointer INTRO_WALK_PTR_A (0x63C2, path B), the
 *           sprite-object block/Y-column (via the rst-0x38 vector), and on path C the
 *           SPRITE_BUFFER header, the scrolled climb graphic, SND_TRIGGER+2 (0x6082), the
 *           drawBoardLayout playfield draw, 0x74AA/0x748A, CUTSCENE_BAND_COUNT (0x638D),
 *           SUBSTATE_TIMER, INTRO_STEP (incremented) and SEQ_ADVANCE_PTR. No live registers
 *           or flags (the oracle's residual A/HL/F are dead ABI). SP/pc are NOT compared: the
 *           idiomatic layer drops the oracle's stack model (its final `ret` alone nets SP+2),
 *           and the JS call stack replaces it — the same convention as the sibling drawBoardLayout.
 * NAMES:    FRAME, SUBSTATE_TIMER, INTRO_STEP, SEQ_ADVANCE_PTR, SPRITE_OBJ_BLOCK,
 *           SPRITE_BUFFER, INTRO_WALK_PTR_A (0x63C2), CUTSCENE_BAND_COUNT (0x638D),
 *           INTRO_SCROLL_INDEX (0x638E), and SND_TRIGGER (0x6080; the beat's sound is
 *           SND_TRIGGER+2 = 0x6082) from ram.js. Kept hex: video cells 0x74AA/0x748A and
 *           the ROM tables 0x385C / 0x392C.
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
} from "./ram.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js"; // ROM 0x004e
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js"; // ROM 0x0038
import { scrollClimbGraphicStep } from "./scrollClimbGraphicStep.js"; // ROM 0x304a
import { drawBoardLayout } from "./drawBoardLayout.js"; // ROM 0x0da7

const DISPLAY_Y_CELL = SPRITE_OBJ_BLOCK + 3; // 0x690b — the Y column of the sprite-object records
const WALK_TERMINATOR = 0x7f; // sentinel byte that ends the walk -> terminal setup
const SOUND_LATCH = SND_TRIGGER + 2; // 0x6082 — 3-frame audio-assert latch for the beat
const PROP_TEMPLATE = 0x385c; // ROM: sprite-object template loaded on the terminal beat
const LAYOUT_TABLE = 0x392c; // ROM: board-layout segment table handed to drawBoardLayout
const VIDEO_CELL_A = 0x74aa; // video-RAM cell stamped on the terminal beat
const VIDEO_CELL_B = 0x748a; // video-RAM cell stamped on the terminal beat

export function loc_0b06(m) {
  const { regs, mem } = m;

  // -- PATH A: parity idle. `rrca` rotates FRAME's bit 0 into carry; `ret c` returns on
  // odd frames, halving the walk rate so the cutscene builds at the intended speed.
  if (mem.read8(FRAME) & 0x01) return;

  // Follow the indirect walk pointer into the ROM record table and read the next byte.
  const ptr = mem.read16(INTRO_WALK_PTR_A);
  const byte = mem.read8(ptr);

  if (byte !== WALK_TERMINATOR) {
    // -- PATH B: walk one non-sentinel byte. Advance the pointer and add the (signed)
    // byte into the Y column of all ten sprite-object records via the rst-0x38 vector.
    mem.write16(INTRO_WALK_PTR_A, (ptr + 1) & 0xffff);
    regs.hl = DISPLAY_Y_CELL; // rst-0x38 base: which field to add into
    regs.c = byte; // the signed delta
    addToSpriteObjectColumn(m);
    return;
  }

  // -- PATH C: the 0x7F terminator -> finalize this cutscene beat. --

  // Load the next sprite-object template from ROM 0x385C into SPRITE_OBJ_BLOCK. The block
  // copy leaves HL at the template's end (0x385C + 0x28 = 0x3884); the next copy chains
  // off that leftover pointer, exactly as the oracle does (it never reloads HL).
  regs.hl = PROP_TEMPLATE;
  loadSpriteObjectBlock(m);

  // Copy 8 more bytes from the template's end (0x3884) into SPRITE_BUFFER (0x6900), the
  // 8-byte header just below the sprite-object block.
  let src = regs.hl; // 0x3884, left by loadSpriteObjectBlock
  let dst = SPRITE_BUFFER; // 0x6900
  for (let i = 0; i < 8; i++) {
    mem.write8(dst, mem.read8(src));
    src = (src + 1) & 0xffff;
    dst = (dst + 1) & 0xffff;
  }

  // Reposition the freshly-loaded row via the rst-0x38 vector: +0x50 on the X column
  // (0x6908) and -4 on the Y column (0x690b), each applied across all ten records.
  regs.hl = SPRITE_OBJ_BLOCK; // 0x6908 — the X column
  regs.c = 0x50;
  addToSpriteObjectColumn(m);
  regs.hl = DISPLAY_Y_CELL; // 0x690b — the Y column
  regs.c = 0xfc; // -4
  addToSpriteObjectColumn(m);

  // Scroll the climb graphic up until its loop counter reaches 0x0A. scrollClimbGraphicStep
  // decrements INTRO_SCROLL_INDEX each pass, so this is a synchronous advance to a fixed target.
  do {
    scrollClimbGraphicStep(m);
  } while (mem.read8(INTRO_SCROLL_INDEX) !== 0x0a);

  // Assert the beat's sound (a 3-frame latch), then draw the board-layout segment table.
  mem.write8(SOUND_LATCH, 0x03);
  regs.de = LAYOUT_TABLE; // 0x392c — drawBoardLayout reads DE
  drawBoardLayout(m);

  // Terminal-beat epilogue: stamp two video cells, set the cutscene band count, arm the
  // 32-frame phase timer, advance the cutscene step, and re-seed loc_3069's gated pointer.
  mem.write8(VIDEO_CELL_A, 0x10);
  mem.write8(VIDEO_CELL_B, 0x10);
  mem.write8(CUTSCENE_BAND_COUNT, 0x05);
  mem.write8(SUBSTATE_TIMER, 0x20); // arm the 32-frame phase countdown
  mem.write8(INTRO_STEP, (mem.read8(INTRO_STEP) + 1) & 0xff); // inc (0x6385) — advance the step
  mem.write16(SEQ_ADVANCE_PTR, INTRO_STEP); // 0x63c0 <- 0x6385
}
