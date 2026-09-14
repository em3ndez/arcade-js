// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_9e, DRAW_STYLE, ENEMY_SLOT_FLAGS, ENEMY_SEGMENT, SEG_SHAPE_BY_STYLE } from "./names.js";
import { buildSlotScreenPoint } from "./buildSlotScreenPoint.js";
import { drawTubeRimSegmentFromCorner, emitTubeRimSegmentVectors } from "./drawTubeRimSegmentFromCorner.js";

// Set the run count, then split on the slot's sign byte: a negative slot preps a
// coordinate and builds a segment at corner zero; otherwise build one at the slot's
// corner using a header byte picked from a small table by the shared style index.
export function drawSlotRimSegment(m, x = m.regs.x) {
  const { mem8 } = m;
  mem8[loc_9e] = 0x03;
  if (mem8[u16(ENEMY_SLOT_FLAGS + x)] & 0x80) {
    buildSlotScreenPoint(m, x);
    emitTubeRimSegmentVectors(m, 0x00);
    return;
  }
  const corner = mem8[u16(ENEMY_SEGMENT + x)];
  const style = mem8[DRAW_STYLE];
  drawTubeRimSegmentFromCorner(m, mem8[u16(SEG_SHAPE_BY_STYLE + style)], corner);
}
