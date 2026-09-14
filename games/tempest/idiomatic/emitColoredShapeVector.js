// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { DRAW_STYLE, DRAW_CURSOR_LO, SEG_SPREAD_A_LO, DRAW_CURSOR_OFFSET, OBJ_TEMPLATE_WORD_LO, OBJ_TEMPLATE_WORD_HI } from "./names.js";
import { projectPointThroughMathbox } from "./projectPointThroughMathbox.js";
import { layHeaderAndBuildRecord } from "./layHeaderAndBuildRecord.js";
import { appendNormalizedMantissaExponent } from "./appendNormalizedMantissaExponent.js";
import { emitVectorWordAtOffset } from "./emitVectorWordAtOffset.js";

// Fold the live deltas, lay the fixed header, then append the (mantissa, exponent) pair: the
// appender returns its exit cursor, threaded into the two vector-list stores below. Clamp the
// colour/intensity nibble, emit two bytes at the cursor, then reload the entry template from a
// word table and tail into the emitter.
export function emitColoredShapeVector(m) {
  const { mem8, mem16 } = m;
  projectPointThroughMathbox(m);
  layHeaderAndBuildRecord(m, 0x61);
  mem8[DRAW_CURSOR_OFFSET] = 0x00;
  const yExit = appendNormalizedMantissaExponent(m); // appended pair returns its exit cursor

  // Clamp the color/intensity nibble, then shift it into the high nibble of the first byte.
  let a = mem8[SEG_SPREAD_A_LO] ^ 0x07;
  a = (a << 1) & 0xff;
  if (a < 0x0a) a = 0x0a;
  a = (a << 4) & 0xff;

  const ptr = mem16[DRAW_CURSOR_LO];
  let y = yExit;
  mem8[u16(ptr + y)] = a;
  y = (y + 1) & 0xff;
  mem8[u16(ptr + y)] = 0x60;
  y = (y + 1) & 0xff;
  mem8[DRAW_CURSOR_OFFSET] = y; // record the advanced cursor length

  // Reload the template, restore the cursor, tail out.
  y = mem8[DRAW_STYLE];
  const x = mem8[u16(OBJ_TEMPLATE_WORD_HI + y)];
  a = mem8[u16(OBJ_TEMPLATE_WORD_LO + y)];
  y = mem8[DRAW_CURSOR_OFFSET];
  return emitVectorWordAtOffset(m, a, x, y);
}
