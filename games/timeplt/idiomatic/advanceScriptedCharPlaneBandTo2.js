// SPDX-License-Identifier: GPL-3.0-only
/** advanceScriptedCharPlaneBandTo2 — advance one frame of the scripted character-plane animation, chosen by bit 0 of a
 * per-pass counter. Even passes blank two plane columns and six loose cells to the blank tile. Odd
 * passes read the byte under the script cursor: 0xff ends the script — the counter is zeroed, the
 * stage set to 2 and the cursor stepped back one, returning early with no decrement. Otherwise the
 * saved run is laid back down a column, two cursor bits each nudge a set of row counters up, the
 * column's shapes are stepped twice through the script, and the column is gathered back into its
 * run. Every non-early pass ends by decrementing the counter. LIVE-OUT: memory. */

import { fillCellRun } from "./fillCellRun.js";
import { restoreColumnFromSavedRun } from "./restoreColumnFromSavedRun.js";
import { stepThirteenScriptedGlyphCells } from "./stepThirteenScriptedGlyphCells.js";
import { gatherCharColumnIntoBackingRun } from "./gatherCharColumnIntoBackingRun.js";
import { BAND_SCRIPT_CURSOR, BAND_TO2_PASS_COUNTDOWN, INTRO_ANIMATION_STEP } from "./names.js";

const BLANK_TILE = 0xf1;
const ROW = 0x20;
const END_OF_SCRIPT = 0xff;

export function advanceScriptedCharPlaneBandTo2(m) {
  const { regs, mem8, mem16 } = m;

  if ((mem8[BAND_TO2_PASS_COUNTDOWN] & 1) === 0) {
    regs.a = BLANK_TILE;
    regs.hl = 0xa7b1; fillCellRun(m);
    regs.hl = 0xa5d1; fillCellRun(m);
    for (const cell of [0xa610, 0xa611, 0xa612]) {
      mem8[cell] = BLANK_TILE;
      mem8[cell - ROW] = BLANK_TILE;
    }
  } else {
    if (mem8[mem16[BAND_SCRIPT_CURSOR]] === END_OF_SCRIPT) {
      mem8[BAND_TO2_PASS_COUNTDOWN] = 0;
      mem8[INTRO_ANIMATION_STEP] = 2;
      mem16[BAND_SCRIPT_CURSOR] = mem16[BAND_SCRIPT_CURSOR] - 1;
      return;
    }
    restoreColumnFromSavedRun(m);

    let cursor = mem16[BAND_SCRIPT_CURSOR];
    const firstBit = mem8[cursor] & 1;
    mem16[BAND_SCRIPT_CURSOR] = cursor + 1;
    if (firstBit !== 0) {
      mem8[0xa5f0] = mem8[0xa5f0] + 1;
      mem8[0xa610] = mem8[0xa610] + 1;
      mem8[0xa5f2] = mem8[0xa5f2] + 1;
      mem8[0xa612] = mem8[0xa612] + 1;
    }

    cursor = mem16[BAND_SCRIPT_CURSOR];
    const secondBit = mem8[cursor] & 1;
    mem16[BAND_SCRIPT_CURSOR] = cursor + 1;
    if (secondBit !== 0) {
      mem8[0xa5f1] = mem8[0xa5f1] + 1;
      mem8[0xa611] = mem8[0xa611] + 1;
    }

    stepThirteenScriptedGlyphCells(m, 0xa5d1, 2);
    mem16[BAND_SCRIPT_CURSOR] = mem16[BAND_SCRIPT_CURSOR] - 13;
    stepThirteenScriptedGlyphCells(m, 0xa631, 0);
    gatherCharColumnIntoBackingRun(m);
  }

  mem8[BAND_TO2_PASS_COUNTDOWN] = mem8[BAND_TO2_PASS_COUNTDOWN] - 1;
}
