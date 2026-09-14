// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { DRAW_STYLE, PROJ_PT_Y, PROJ_PT_X, SEG_MID_X, SEG_MID_Y } from "./names.js";
import { emitColoredShapeVector } from "./emitColoredShapeVector.js";

/**
 * seatShapeParamsAndEmit -- stage a shape record's style + screen position, then emit its vector. ROM 0xbcfd.
 *
 * Role in the machine: the common seat-and-emit tail shared by both shape drawers -- drawSlotShapeList (the
 * twelve tube-slot shapes) and drawEnemyShapeList (one record per active enemy). Tempest's objects live at
 * a rim segment, and each segment carries a precomputed screen midpoint. This helper takes the caller's
 * chosen draw style in A and a segment index in Y, plants the style and the segment's midpoint into the
 * draw-builder's work cells, and hands off to the coloured-vector emitter.
 *
 * Behavior: writes the style byte A into DRAW_STYLE (loc_55, the colour/style selector the object-record
 * builder reads). Then indexes the two per-segment midpoint tables by Y -- SEG_MID_X (loc_435) into
 * PROJ_PT_Y (loc_56) and SEG_MID_Y (loc_445) into PROJ_PT_X (loc_58) -- seating the shape at that segment's
 * screen point (the X/Y naming is the ROM's, carried through verbatim). Tail-calls emitColoredShapeVector
 * (0xbd09) and returns its result to the caller.
 *
 * Live-out: DRAW_STYLE, PROJ_PT_Y and PROJ_PT_X staged for the draw builder, plus whatever
 * emitColoredShapeVector appends to the vector list. Grounding: [seen].
 */
export function seatShapeParamsAndEmit(m, a = m.regs.a, y = m.regs.y) {
  const { mem8 } = m;
  mem8[DRAW_STYLE] = a;                              // colour/style selector for the object-record builder
  mem8[PROJ_PT_Y] = mem8[u16(SEG_MID_X + y)];        // segment Y-midpoint -> projection point (ROM's naming)
  mem8[PROJ_PT_X] = mem8[u16(SEG_MID_Y + y)];        // segment X-midpoint -> projection point
  return emitColoredShapeVector(m);                  // tail into the coloured-vector emitter (0xbd09)
}
