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
import { loc_56e4 } from "./loc_56e4.js";
import { loc_4a9d } from "./loc_4a9d.js";
import { gatherCharColumnIntoBackingRun } from "./gatherCharColumnIntoBackingRun.js";

const COUNTDOWN = 0xa9f4;
const SCRIPT_POINTER = 0xa9f7;
const NEXT_STEP_CELL = 0xa9f0;
const NEXT_STEP = 0x04;
const FILL = 0xf1;
const SCRIPT_STRIDE = 13;

export function advanceScriptedCharPlaneBandTo4(m) {
  const { regs, mem8, mem16 } = m;

  if ((mem8[COUNTDOWN] & 1) === 0) {
    regs.a = FILL;
    regs.hl = 0xa7b1;
    fillCellRun(m);
    regs.hl = 0xa5d1;
    fillCellRun(m);
    mem8[0xa610] = FILL;
    mem8[0xa5f0] = FILL;
    mem8[0xa611] = FILL;
    mem8[0xa5f1] = FILL;
    mem8[0xa612] = FILL;
    mem8[0xa5f2] = FILL;
  } else {
    if ((mem8[mem16[SCRIPT_POINTER]] & 0xfe) !== 0) {
      mem8[COUNTDOWN] = 0;
      mem8[NEXT_STEP_CELL] = NEXT_STEP;
      loc_56e4(m);
      mem16[SCRIPT_POINTER] = u16(mem16[SCRIPT_POINTER] + 1);
      return;
    }
    restoreColumnFromSavedRun(m);

    loc_4a9d(m, 0xa451, 0x01);
    mem16[SCRIPT_POINTER] = u16(mem16[SCRIPT_POINTER] + SCRIPT_STRIDE);
    loc_4a9d(m, 0xa7b1, 0x03);

    let lower = mem8[mem16[SCRIPT_POINTER]] & 1;
    mem16[SCRIPT_POINTER] = u16(mem16[SCRIPT_POINTER] - 1);
    if (lower) {
      mem8[0xa5f1] = u8(mem8[0xa5f1] - 1);
      mem8[0xa611] = u8(mem8[0xa611] - 1);
    }

    lower = mem8[mem16[SCRIPT_POINTER]] & 1;
    mem16[SCRIPT_POINTER] = u16(mem16[SCRIPT_POINTER] - 1);
    if (lower) {
      mem8[0xa5f0] = u8(mem8[0xa5f0] - 1);
      mem8[0xa610] = u8(mem8[0xa610] - 1);
      mem8[0xa5f2] = u8(mem8[0xa5f2] - 1);
      mem8[0xa612] = u8(mem8[0xa612] - 1);
    }

    gatherCharColumnIntoBackingRun(m);
  }

  mem8[COUNTDOWN] = u8(mem8[COUNTDOWN] - 1);
}
