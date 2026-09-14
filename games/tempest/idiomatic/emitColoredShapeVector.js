// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { DRAW_STYLE, DRAW_CURSOR_LO, SEG_SPREAD_A_LO, DRAW_CURSOR_OFFSET, OBJ_TEMPLATE_WORD_LO, OBJ_TEMPLATE_WORD_HI } from "./names.js";
import { projectPointThroughMathbox } from "./projectPointThroughMathbox.js";
import { layHeaderAndBuildRecord } from "./layHeaderAndBuildRecord.js";
import { appendNormalizedMantissaExponent } from "./appendNormalizedMantissaExponent.js";
import { emitVectorWordAtOffset } from "./emitVectorWordAtOffset.js";

/**
 * emitColoredShapeVector — build one coloured object shape record into the vector display list. ROM 0xbd09.
 *
 * Role in the machine: this is a full object-draw builder for a moving/animated shape in the tube (called
 * by drawTimedObjectList and kin). It projects the object's world point to screen space, lays a fixed
 * record header, appends its normalized coordinate pair, then stamps the object's colour/intensity into the
 * record and finally reloads a per-style glyph template word so the shape is drawn in the chosen entry form.
 *
 * Behavior: (1) projectPointThroughMathbox folds the live coordinate deltas through the math box.
 * (2) layHeaderAndBuildRecord(0x61) writes the fixed record header. (3) reset the cursor offset (0xa9) and
 * appendNormalizedMantissaExponent lays the (mantissa, exponent) pair, returning the exit cursor yExit.
 * (4) Derive the colour byte from SEG_SPREAD_A_LO (0x78): XOR 0x07 (invert the low colour bits), double it,
 * floor to 0x0a so intensity never drops below a visible minimum, then move it into the high nibble.
 * (5) At the draw cursor (loc_74) write that colour byte, then 0x60, advancing y each time, and record the
 * new run length back into the cursor offset. (6) Reload the entry template: index the LO/HI template-word
 * tables (0xcec8/0xcec9) by DRAW_STYLE (0x55), restore the cursor offset into y, and tail into
 * emitVectorWordAtOffset to emit the templated glyph word.
 *
 * Live-out: the vector display list gains the coloured shape record (header, coord pair, colour+0x60 bytes,
 * template word); DRAW_CURSOR_OFFSET (0xa9) holds the advanced run length. Grounding: [seen].
 */
// Fold the live deltas, lay the fixed header, then append the (mantissa, exponent) pair: the
// appender returns its exit cursor, threaded into the two vector-list stores below. Clamp the
// colour/intensity nibble, emit two bytes at the cursor, then reload the entry template from a
// word table and tail into the emitter.
export function emitColoredShapeVector(m) {
  const { mem8, mem16 } = m;
  projectPointThroughMathbox(m);        // fold live coordinate deltas through the math box
  layHeaderAndBuildRecord(m, 0x61);     // 0x61 = fixed record header for this shape record
  mem8[DRAW_CURSOR_OFFSET] = 0x00;      // reset run length before the pair is appended
  const yExit = appendNormalizedMantissaExponent(m); // appended pair returns its exit cursor

  // Clamp the color/intensity nibble, then shift it into the high nibble of the first byte.
  let a = mem8[SEG_SPREAD_A_LO] ^ 0x07; // invert the low colour bits of the interpolated attribute
  a = (a << 1) & 0xff;                  // double it
  if (a < 0x0a) a = 0x0a;               // floor intensity to a visible minimum
  a = (a << 4) & 0xff;                  // seat it in the high nibble

  const ptr = mem16[DRAW_CURSOR_LO];    // the vector display-list write pointer
  let y = yExit;
  mem8[u16(ptr + y)] = a;               // colour/intensity byte
  y = (y + 1) & 0xff;
  mem8[u16(ptr + y)] = 0x60;            // 0x60 = fixed companion attribute byte
  y = (y + 1) & 0xff;
  mem8[DRAW_CURSOR_OFFSET] = y; // record the advanced cursor length

  // Reload the template, restore the cursor, tail out.
  y = mem8[DRAW_STYLE];                 // style selector indexes the template-word tables
  const x = mem8[u16(OBJ_TEMPLATE_WORD_HI + y)]; // high byte of the entry glyph word
  a = mem8[u16(OBJ_TEMPLATE_WORD_LO + y)];       // low byte of the entry glyph word
  y = mem8[DRAW_CURSOR_OFFSET];         // restore the run length as the emit offset
  return emitVectorWordAtOffset(m, a, x, y);
}
