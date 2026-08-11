// SPDX-License-Identifier: GPL-3.0-only
/** stepThirteenScriptedGlyphCells — step thirteen cells of the character plane on by one shape each, but only where a
 * script says so. The script is walked through one shared cursor cell, a byte per plane cell, and
 * a byte of zero leaves its cell alone; the cursor is left where the walk ended rather than
 * rewound, so a caller wanting those thirteen bytes again must put it back itself. Two bits of
 * one incoming byte set the directions independently: the low bit turns the walk round, so the
 * script is read backwards and the shape steps DOWN instead of up, and the next bit decides
 * whether the plane cells are taken a row down or a row up from the one given.
 * LIVE-OUT: memory-only. */

import { u8, u16 } from "../../../core/int.js";
import { BAND_SCRIPT_CURSOR } from "./names.js";

const CELLS = 13;
const ROW = 0x20;
const BACKWARDS = 0x01;
const UPWARDS = 0x02;

export function stepThirteenScriptedGlyphCells(m, firstCell = m.regs.de, directions = m.regs.c) {
  const { mem8, mem16 } = m;
  const shapeStep = (directions & BACKWARDS) !== 0 ? -1 : 1;
  const rowStep = (directions & UPWARDS) !== 0 ? -ROW : ROW;
  let cell = firstCell;
  for (let i = 0; i < CELLS; i++) {
    const cursor = mem16[BAND_SCRIPT_CURSOR];
    if (mem8[cursor] !== 0) mem8[cell] = u8(mem8[cell] + shapeStep);
    cell = u16(cell + rowStep);
    mem16[BAND_SCRIPT_CURSOR] = u16(cursor + shapeStep);
  }
}
