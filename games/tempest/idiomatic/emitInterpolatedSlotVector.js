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

/**
 * emitInterpolatedSlotVector -- project one enemy slot to the tube and emit its vector word. ROM 0xb69b.
 *
 * Role in the machine: draws one active enemy (Flipper, Tanker, etc.) sitting in slot x. Enemies live on
 * the 16 tube segments; a slot carries its depth down the tube, its segment, and a phase byte that says
 * whether it is mid-flip between two segments. This routine builds the enemy's projected screen position,
 * runs it through the 3D "mathbox" projection, and lays the resulting vector word so the AVG draws it.
 *
 * Behavior: copy the slot's depth (ENEMY_DEPTH+x) into the projection depth (OBJ_DEPTH), read its segment,
 * and load that segment's base X/Y from the two segment tables (SEG_BASE_X/SEG_BASE_Y) into the projection
 * point. When the phase byte is negative (bit7 set) the enemy is flipping: compute the delta to the next
 * segment (wrapping 0..15), scale it by the phase fraction (scaleByPhaseFraction), and add it in so the
 * point interpolates between the two segments. Project the point (projectPointThroughMathbox), lay the
 * fixed 0x61 header and build the record (layHeaderAndBuildRecord), then append the normalized
 * (mantissa, exponent) pair -- the appender returns its exit cursor, saved to and reloaded from
 * DRAW_CURSOR_OFFSET. Finally pick a template word from the frame-phased table (index = (FRAME_COUNTER&3)
 * <<1, +0x4e) and emit it at the saved cursor offset.
 *
 * Live-out: OBJ_DEPTH, PROJ_PT_X/PROJ_PT_Y, DRAW_CURSOR_OFFSET, and the vector word(s) appended to the
 * display list by the header/record/emit helpers. Grounding: [seen].
 */
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
