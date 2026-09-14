// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_9e, DRAW_STYLE, ENEMY_SLOT_FLAGS, ENEMY_SEGMENT, SEG_SHAPE_BY_STYLE } from "./names.js";
import { buildSlotScreenPoint } from "./buildSlotScreenPoint.js";
import { drawTubeRimSegmentFromCorner, emitTubeRimSegmentVectors } from "./drawTubeRimSegmentFromCorner.js";

/**
 * drawSlotRimSegment — draw the tube-rim segment belonging to enemy slot x. ROM 0xb5eb.
 *
 * Role in the machine: the playfield well is drawn as a ring of rim segments, and each enemy slot
 * can contribute a segment on the rim at its lane. This routine emits one slot's rim segment. A
 * slot flagged negative (high bit of its flag byte set) is one whose screen position must be
 * computed fresh and drawn against corner 0; a normal slot is drawn at its own recorded tube corner
 * using a shape header chosen by the current draw style.
 *
 * Behavior: set the segment run count loc_9e = 3 (three vectors make the segment). Test the slot's
 * flag byte ENEMY_SLOT_FLAGS+x (loc_283+x): if its sign bit is set, build the slot's screen point
 * (buildSlotScreenPoint) and emit the rim vectors anchored at corner 0 (emitTubeRimSegmentVectors),
 * then return. Otherwise read the slot's own tube corner ENEMY_SEGMENT+x (loc_2b9+x) and the shared
 * draw style DRAW_STYLE (loc_55), index the per-style header table SEG_SHAPE_BY_STYLE (loc_b60b) by
 * that style, and build the rim segment from that corner via drawTubeRimSegmentFromCorner.
 *
 * Live-out: loc_9e (run count) and the display list grown by the chosen emit path. Grounding: [seen]
 */
export function drawSlotRimSegment(m, x = m.regs.x) {
  const { mem8 } = m;
  mem8[loc_9e] = 0x03;                              // three vectors per rim segment
  if (mem8[u16(ENEMY_SLOT_FLAGS + x)] & 0x80) {     // negative slot flag → compute point, corner 0
    buildSlotScreenPoint(m, x);                     // derive this slot's screen coordinate
    emitTubeRimSegmentVectors(m, 0x00);             // build the segment anchored at corner 0
    return;
  }
  const corner = mem8[u16(ENEMY_SEGMENT + x)];      // the slot's own tube corner (loc_2b9+x)
  const style = mem8[DRAW_STYLE];                   // shared draw-style index (loc_55)
  // Header byte picked from the per-style table by style, drawn from the slot's corner.
  drawTubeRimSegmentFromCorner(m, mem8[u16(SEG_SHAPE_BY_STYLE + style)], corner);
}
