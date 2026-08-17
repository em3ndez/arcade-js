// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimArm4 — frog-animation arm 4 (sibling of arm 0). Loads its row-advance/count/column from
 * the lane-parameter block (the arm-4 triple at ACTIVE_LANE_PARAM_BLOCK + 12), points the destination +
 * pattern pointers, arms the plot cursors, and enters the shared render loop (kept dispatched by
 * address). The seven outgoing register values are handed to the loop as a return-line register bridge.
 * Its pointer cells already carry the scroll subsystem's names (shared block). LIVE-OUT: memory-only.
 */
import {
  ACTIVE_LANE_PARAM_BLOCK,
  SCROLL_COPY_COLUMN_STRIDE,
  SCROLL_COPY_SRC_PTR,
  LANE_OBJLIST_8124,
  SCROLL_COPY_DEST_PTR_ALT,
  SCROLL_BAND_SRC_PHASE16,
  FROG_ANIM_RENDER_LOOP,
} from "./names.js";

export function renderFrogAnimArm4(m) {
  const { mem8, mem16 } = m;

  const rowAdvance = mem8[ACTIVE_LANE_PARAM_BLOCK + 12];
  const rowCount = mem8[ACTIVE_LANE_PARAM_BLOCK + 13];
  const columnIndex = mem8[ACTIVE_LANE_PARAM_BLOCK + 14];
  const destPtr = mem16[SCROLL_COPY_DEST_PTR_ALT];

  mem8[SCROLL_COPY_COLUMN_STRIDE] = rowAdvance;
  mem16[SCROLL_COPY_SRC_PTR] = SCROLL_BAND_SRC_PHASE16;

  return (m.regs.a = rowAdvance), (m.regs.b = rowCount), (m.regs.c = columnIndex), (m.regs.hl = destPtr), (m.regs.de = SCROLL_BAND_SRC_PHASE16), (m.regs.ix = LANE_OBJLIST_8124), (m.regs.iy = LANE_OBJLIST_8124), m.call(FROG_ANIM_RENDER_LOOP);
}
