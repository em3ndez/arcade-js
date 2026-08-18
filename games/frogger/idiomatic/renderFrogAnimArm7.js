// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimArm7 — frog-animation arm 7. Loads its row-advance/count/column from the lane-parameter
 * block (arm-7 triple at ACTIVE_LANE_PARAM_BLOCK + 21), stashes the column stride + tile source, then
 * calls the shared render loop directly with this arm's dest/source/cursors. LIVE-OUT: memory-only.
 */
import {
  ACTIVE_LANE_PARAM_BLOCK,
  SCROLL_COPY_COLUMN_STRIDE,
  SCROLL_COPY_SRC_PTR,
  LANE_OBJLIST_813F,
  FROG_ANIM_ARM7_DEST_PTR,
  FROG_ANIM_ARM7_SRC_BASE,
} from "./names.js";
import { renderFrogAnimTileColumns } from "./renderFrogAnimTileColumns.js";

export function renderFrogAnimArm7(m) {
  const { mem8, mem16 } = m;

  const rowAdvance = mem8[ACTIVE_LANE_PARAM_BLOCK + 21];
  const rowCount = mem8[ACTIVE_LANE_PARAM_BLOCK + 22];
  const columnIndex = mem8[ACTIVE_LANE_PARAM_BLOCK + 23];
  const destPtr = mem16[FROG_ANIM_ARM7_DEST_PTR];

  mem8[SCROLL_COPY_COLUMN_STRIDE] = rowAdvance;
  mem16[SCROLL_COPY_SRC_PTR] = FROG_ANIM_ARM7_SRC_BASE;

  return renderFrogAnimTileColumns(m, rowCount, columnIndex, destPtr, FROG_ANIM_ARM7_SRC_BASE, LANE_OBJLIST_813F, LANE_OBJLIST_813F);
}
