// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, loc_9e, ENEMY_ANIM_ACCUM, ENEMY_SLOT_FLAGS, ENEMY_SEGMENT, SEG_STYLE_TABLE } from "./names.js";
import { buildSlotScreenPoint } from "./buildSlotScreenPoint.js";
import { drawTubeRimSegmentFromCorner, emitTubeRimSegmentVectors } from "./drawTubeRimSegmentFromCorner.js";

// Latch a run flag from a control cell's sign and a table-picked style byte (indexed by
// that cell's clamped high nibble), then split on the slot's sign to build the segment.
export function drawStyledSlotRimSegment(m, x = m.regs.x) {
  const { mem8 } = m;
  mem8[loc_9e] = (mem8[ENEMY_ANIM_ACCUM] & 0x80) ? 0x04 : 0x00;
  let idx = ((mem8[ENEMY_ANIM_ACCUM] + 0x40) & 0xff) >> 4;
  if (idx >= 0x05) idx = 0x00;
  mem8[loc_29] = mem8[u16(SEG_STYLE_TABLE + idx)];
  if (mem8[u16(ENEMY_SLOT_FLAGS + x)] & 0x80) {
    buildSlotScreenPoint(m, x);
    emitTubeRimSegmentVectors(m, mem8[loc_29]);
    return;
  }
  const corner = mem8[u16(ENEMY_SEGMENT + x)];
  drawTubeRimSegmentFromCorner(m, mem8[loc_29], corner);
}
