// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimArm2 — frog-animation arm 2 (sibling of arm 0). Loads its row-advance/count/column from
 * the lane-parameter block (the arm-2 triple at ACTIVE_LANE_PARAM_BLOCK + 6), points the destination +
 * pattern pointers, arms the plot cursors, and enters the shared render loop (kept dispatched by
 * address). The seven outgoing register values are handed to the loop as a return-line register bridge.
 * LIVE-OUT: memory-only.
 */
import {
  ACTIVE_LANE_PARAM_BLOCK,
  SCROLL_COPY_COLUMN_STRIDE,
  SCROLL_COPY_SRC_PTR,
  LANE_OBJLIST_8112,
  FROG_ANIM_ARM2_DEST_PTR,
  FROG_ANIM_ARM2_SRC_BASE,
  FROG_ANIM_RENDER_LOOP,
} from "./names.js";

export function renderFrogAnimArm2(m) {
  const { mem8, mem16 } = m;

  const rowAdvance = mem8[ACTIVE_LANE_PARAM_BLOCK + 6];
  const rowCount = mem8[ACTIVE_LANE_PARAM_BLOCK + 7];
  const columnIndex = mem8[ACTIVE_LANE_PARAM_BLOCK + 8];
  const destPtr = mem16[FROG_ANIM_ARM2_DEST_PTR];

  mem8[SCROLL_COPY_COLUMN_STRIDE] = rowAdvance;
  mem16[SCROLL_COPY_SRC_PTR] = FROG_ANIM_ARM2_SRC_BASE;

  return (m.regs.a = rowAdvance), (m.regs.b = rowCount), (m.regs.c = columnIndex), (m.regs.hl = destPtr), (m.regs.de = FROG_ANIM_ARM2_SRC_BASE), (m.regs.ix = LANE_OBJLIST_8112), (m.regs.iy = LANE_OBJLIST_8112), m.call(FROG_ANIM_RENDER_LOOP);
}
