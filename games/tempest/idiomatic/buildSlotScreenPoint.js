// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  loc_2e, loc_2f, loc_30, PROJ_PT_Y, OBJ_DEPTH, PROJ_PT_X, CLAMP_TALLY, RUN_SIZE,
  TUBE_SHAPE_INDEX, ENEMY_SEGMENT, ENEMY_PHASE, SEG_BASE_X, SEG_BASE_Y,
  VERTEX_Y_OFS_BY_PHASE, VERTEX_X_OFS_BY_PHASE, STYLE_TABLE_59, STYLE_TABLE_5A,
} from "./names.js";

// Signed-saturating add, in the guest's 0x80-biased (excess-128) coordinate space: un-bias the base
// (^0x80) into two's-complement, add the delta, detect signed overflow the 6502 way (operands share a
// sign that differs from the result's), clamp to 0x7f/0x80 on overflow, then re-bias back to 0x80.
function clampAdd(base, delta) {
  const a = base ^ 0x80;
  const res = (a + delta) & 0xff;
  const overflow = (~(a ^ delta) & (a ^ res) & 0x80) !== 0;
  let out = res;
  if (overflow) out = res & 0x80 ? 0x7f : 0x80;   // clamp toward the sign that overflowed
  return (out ^ 0x80) & 0xff;
}

/**
 * buildSlotScreenPoint -- project one tube slot's animated vertex to a screen point. ROM 0xb634.
 *
 * Role in the machine: Tempest's playfield is a tube of segments (slots) around a rim, and the rim
 * segments flex during zoom/warp animation. This routine computes the on-screen X/Y for slot x's
 * corner, including its per-phase animation offset, and stages the drawing style, so the rim-segment
 * drawers (drawSlotRimSegment / drawStyledSlotRimSegment) can lay the vector for that slot.
 *
 * Behavior: it copies the current depth OBJ_DEPTH into loc_2f (the point's projection scratch), then
 * indexes the slot's segment number ENEMY_SEGMENT[x] to look up the base vertex coordinates from
 * SEG_BASE_X / SEG_BASE_Y into the projection cells PROJ_PT_Y (base X) and PROJ_PT_X (base Y). It reads
 * the animation phase ENEMY_PHASE[x] (low nibble) and adds the signed per-phase vertex offsets
 * VERTEX_X_OFS_BY_PHASE / VERTEX_Y_OFS_BY_PHASE to each base with saturating clampAdd, landing the
 * finished point in loc_2e (screen X) and loc_30 (screen Y). Finally it indexes the current tube shape
 * TUBE_SHAPE_INDEX to load a style byte pair from STYLE_TABLE_59 / STYLE_TABLE_5A into CLAMP_TALLY
 * (loc_59) and RUN_SIZE (loc_5a).
 *
 * Live-out: loc_2e (screen X), loc_30 (screen Y), loc_2f (depth), PROJ_PT_X/PROJ_PT_Y (base coords),
 * and the style pair CLAMP_TALLY (loc_59) / RUN_SIZE (loc_5a).
 *
 * Grounding: [seen].
 */
export function buildSlotScreenPoint(m, x = m.regs.x) {
  const { mem8 } = m;
  mem8[loc_2f] = mem8[OBJ_DEPTH];                        // stage the projection depth
  const coordIdx = mem8[u16(ENEMY_SEGMENT + x)];         // slot x's segment number keys the base vertex
  mem8[PROJ_PT_Y] = mem8[u16(SEG_BASE_X + coordIdx)];    // base X of the segment corner
  mem8[PROJ_PT_X] = mem8[u16(SEG_BASE_Y + coordIdx)];    // base Y of the segment corner
  const deltaIdx = mem8[u16(ENEMY_PHASE + x)] & 0x0f;    // animation phase (low nibble) keys the offset
  mem8[loc_2e] = clampAdd(mem8[PROJ_PT_Y], mem8[u16(VERTEX_X_OFS_BY_PHASE + deltaIdx)]);  // screen X
  mem8[loc_30] = clampAdd(mem8[PROJ_PT_X], mem8[u16(VERTEX_Y_OFS_BY_PHASE + deltaIdx)]);  // screen Y
  const styleIdx = mem8[TUBE_SHAPE_INDEX];               // current tube shape keys the draw style
  mem8[CLAMP_TALLY] = mem8[u16(STYLE_TABLE_59 + styleIdx)];  // style pair -> loc_59
  mem8[RUN_SIZE] = mem8[u16(STYLE_TABLE_5A + styleIdx)];     // style pair -> loc_5a
}
