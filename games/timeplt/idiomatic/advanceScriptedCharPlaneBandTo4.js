// SPDX-License-Identifier: GPL-3.0-only
/** advanceScriptedCharPlaneBandTo4 — run one frame of an inter-round band script. Bit 0 of a countdown cell picks the pass and
 *  the tail then decrements that cell, so the two passes alternate. The BLANKING pass fills two
 *  thirteen-cell columns and six lead cells with one tile code. The DRAWING pass reads the script
 *  through a saved pointer: a byte carrying any bit above bit 0 clears the countdown, arms the next
 *  step, requests two sounds, steps the pointer on and ends early; otherwise it restores the working
 *  column, walks the band down then up, lowers six lead cells by the low bit of two script bytes,
 *  gathers the column and falls through to the decrement.
 *  LIVE-OUT: memory-only (the caller returns the instant this does). */

import { u8, u16 } from "../../../core/int.js";
import { fillCellRun } from "./fillCellRun.js";
import { restoreColumnFromSavedRun } from "./restoreColumnFromSavedRun.js";
import { requestInterRoundSoundPair } from "./requestInterRoundSoundPair.js";
import { stepThirteenScriptedGlyphCells } from "./stepThirteenScriptedGlyphCells.js";
import { gatherCharColumnIntoBackingRun } from "./gatherCharColumnIntoBackingRun.js";
import {
  BAND_SCRIPT_CURSOR,
  BAND_TO4_PASS_COUNTDOWN,
  INTRO_ANIMATION_STEP,
  CHAR_PLANE_COLUMN_BASE,
  CHAR_PLANE_UPPER_RUN_BOTTOM,
  CHAR_PLANE_STUB_LEFT_TOP,
  CHAR_PLANE_COLUMN_MID_TOP,
  CHAR_PLANE_STUB_RIGHT_TOP,
  CHAR_PLANE_STUB_LEFT_BOTTOM,
  CHAR_PLANE_COLUMN_MID_BOTTOM,
  CHAR_PLANE_STUB_RIGHT_BOTTOM,
  CHAR_PLANE_LOWER_RUN_BOTTOM,
} from "./names.js";

const NEXT_STEP = 0x04;
const FILL = 0xf1;
const SCRIPT_STRIDE = 13;

export function advanceScriptedCharPlaneBandTo4(m) {
  const { regs, mem8, mem16 } = m;

  if ((mem8[BAND_TO4_PASS_COUNTDOWN] & 1) === 0) {
    regs.a = FILL;
    regs.hl = CHAR_PLANE_LOWER_RUN_BOTTOM;
    fillCellRun(m);
    regs.hl = CHAR_PLANE_UPPER_RUN_BOTTOM;
    fillCellRun(m);
    mem8[CHAR_PLANE_STUB_LEFT_BOTTOM] = FILL;
    mem8[CHAR_PLANE_STUB_LEFT_TOP] = FILL;
    mem8[CHAR_PLANE_COLUMN_MID_BOTTOM] = FILL;
    mem8[CHAR_PLANE_COLUMN_MID_TOP] = FILL;
    mem8[CHAR_PLANE_STUB_RIGHT_BOTTOM] = FILL;
    mem8[CHAR_PLANE_STUB_RIGHT_TOP] = FILL;
  } else {
    if ((mem8[mem16[BAND_SCRIPT_CURSOR]] & 0xfe) !== 0) {
      mem8[BAND_TO4_PASS_COUNTDOWN] = 0;
      mem8[INTRO_ANIMATION_STEP] = NEXT_STEP;
      requestInterRoundSoundPair(m);
      mem16[BAND_SCRIPT_CURSOR] = u16(mem16[BAND_SCRIPT_CURSOR] + 1);
      return;
    }
    restoreColumnFromSavedRun(m);

    stepThirteenScriptedGlyphCells(m, CHAR_PLANE_COLUMN_BASE, 0x01);
    mem16[BAND_SCRIPT_CURSOR] = u16(mem16[BAND_SCRIPT_CURSOR] + SCRIPT_STRIDE);
    stepThirteenScriptedGlyphCells(m, CHAR_PLANE_LOWER_RUN_BOTTOM, 0x03);

    let lower = mem8[mem16[BAND_SCRIPT_CURSOR]] & 1;
    mem16[BAND_SCRIPT_CURSOR] = u16(mem16[BAND_SCRIPT_CURSOR] - 1);
    if (lower) {
      mem8[CHAR_PLANE_COLUMN_MID_TOP] = u8(mem8[CHAR_PLANE_COLUMN_MID_TOP] - 1);
      mem8[CHAR_PLANE_COLUMN_MID_BOTTOM] = u8(mem8[CHAR_PLANE_COLUMN_MID_BOTTOM] - 1);
    }

    lower = mem8[mem16[BAND_SCRIPT_CURSOR]] & 1;
    mem16[BAND_SCRIPT_CURSOR] = u16(mem16[BAND_SCRIPT_CURSOR] - 1);
    if (lower) {
      mem8[CHAR_PLANE_STUB_LEFT_TOP] = u8(mem8[CHAR_PLANE_STUB_LEFT_TOP] - 1);
      mem8[CHAR_PLANE_STUB_LEFT_BOTTOM] = u8(mem8[CHAR_PLANE_STUB_LEFT_BOTTOM] - 1);
      mem8[CHAR_PLANE_STUB_RIGHT_TOP] = u8(mem8[CHAR_PLANE_STUB_RIGHT_TOP] - 1);
      mem8[CHAR_PLANE_STUB_RIGHT_BOTTOM] = u8(mem8[CHAR_PLANE_STUB_RIGHT_BOTTOM] - 1);
    }

    gatherCharColumnIntoBackingRun(m);
  }

  mem8[BAND_TO4_PASS_COUNTDOWN] = u8(mem8[BAND_TO4_PASS_COUNTDOWN] - 1);
}
