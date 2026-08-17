// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimArm7 — frog-animation arm 7 (sibling of arm 0). Loads its row-advance/count/column from
 * the lane-parameter block (the arm-7 triple at ACTIVE_LANE_PARAM_BLOCK + 21), points the destination +
 * pattern pointers, arms the plot cursors, and enters the shared render loop (kept dispatched by
 * address). The seven outgoing register values are handed to the loop as a return-line register bridge.
 * LIVE-OUT: memory-only.
 */
import {
  ACTIVE_LANE_PARAM_BLOCK,
  SCROLL_COPY_COLUMN_STRIDE,
  SCROLL_COPY_SRC_PTR,
  LANE_OBJLIST_813F,
  FROG_ANIM_ARM7_DEST_PTR,
  FROG_ANIM_ARM7_SRC_BASE,
  FROG_ANIM_RENDER_LOOP,
} from "./names.js";

export function renderFrogAnimArm7(m) {
  const { mem8, mem16 } = m;

  const rowAdvance = mem8[ACTIVE_LANE_PARAM_BLOCK + 21];
  const rowCount = mem8[ACTIVE_LANE_PARAM_BLOCK + 22];
  const columnIndex = mem8[ACTIVE_LANE_PARAM_BLOCK + 23];
  const destPtr = mem16[FROG_ANIM_ARM7_DEST_PTR];

  mem8[SCROLL_COPY_COLUMN_STRIDE] = rowAdvance;
  mem16[SCROLL_COPY_SRC_PTR] = FROG_ANIM_ARM7_SRC_BASE;

  return (m.regs.a = rowAdvance), (m.regs.b = rowCount), (m.regs.c = columnIndex), (m.regs.hl = destPtr), (m.regs.de = FROG_ANIM_ARM7_SRC_BASE), (m.regs.ix = LANE_OBJLIST_813F), (m.regs.iy = LANE_OBJLIST_813F), m.call(FROG_ANIM_RENDER_LOOP);
}
