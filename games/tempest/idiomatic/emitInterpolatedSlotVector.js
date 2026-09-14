// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  FRAME_COUNTER, PROJ_PT_Y, OBJ_DEPTH, PROJ_PT_X, DRAW_CURSOR_OFFSET,
  ENEMY_SEGMENT, ENEMY_PHASE, ENEMY_DEPTH, SEG_BASE_X, SEG_BASE_Y, OBJ_TEMPLATE_WORD_LO, OBJ_TEMPLATE_WORD_HI,
} from "./names.js";
import { scaleByPhaseFraction } from "./scaleByPhaseFraction.js";
import { projectPointThroughMathbox } from "./projectPointThroughMathbox.js";
import { layHeaderAndBuildRecord } from "./layHeaderAndBuildRecord.js";
import { appendNormalizedMantissaExponent } from "./appendNormalizedMantissaExponent.js";
import { emitVectorWordAtOffset } from "./emitVectorWordAtOffset.js";

// Build a screen position for slot x and tail into the vector emitter. Load the slot coord and the
// segment-indexed base pair; when the phase byte is negative, interpolate the pair toward the next
// segment by scaling the delta through the fraction helper. Fold the live deltas, lay the fixed
// header, then append the (mantissa, exponent) pair: the appender returns its exit cursor, which is
// persisted and reloaded as the emitter's cursor offset. The entry template is read from a word
// table indexed by the frame's low bits.
export function emitInterpolatedSlotVector(m, x = m.regs.x) {
  const { mem8 } = m;

  mem8[OBJ_DEPTH] = mem8[u16(ENEMY_DEPTH + x)];
  const seg = mem8[u16(ENEMY_SEGMENT + x)];
  mem8[PROJ_PT_Y] = mem8[u16(SEG_BASE_X + seg)];
  mem8[PROJ_PT_X] = mem8[u16(SEG_BASE_Y + seg)];

  const phase = mem8[u16(ENEMY_PHASE + x)];
  if (phase & 0x80) {
    const next = (seg + 1) & 0x0f; // next segment index
    let d0 = (mem8[u16(SEG_BASE_X + next)] - mem8[PROJ_PT_Y]) & 0xff;
    d0 = scaleByPhaseFraction(m, d0, x);
    mem8[PROJ_PT_Y] = d0 + mem8[PROJ_PT_Y];
    let d1 = (mem8[u16(SEG_BASE_Y + next)] - mem8[PROJ_PT_X]) & 0xff;
    d1 = scaleByPhaseFraction(m, d1, x);
    mem8[PROJ_PT_X] = d1 + mem8[PROJ_PT_X];
  }

  projectPointThroughMathbox(m);
  layHeaderAndBuildRecord(m, 0x61);
  mem8[DRAW_CURSOR_OFFSET] = 0x00;
  const yExit = appendNormalizedMantissaExponent(m);   // appended pair returns its exit cursor
  mem8[DRAW_CURSOR_OFFSET] = yExit;        // persist the cursor for the emitter

  const idx = (((mem8[FRAME_COUNTER] & 0x03) << 1) + 0x4e) & 0xff;
  const a = mem8[u16(OBJ_TEMPLATE_WORD_LO + idx)];
  const hx = mem8[u16(OBJ_TEMPLATE_WORD_HI + idx)];
  const y = mem8[DRAW_CURSOR_OFFSET];
  return emitVectorWordAtOffset(m, a, hx, y);
}
