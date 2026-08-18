// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimArm10 — frog-animation arm 10. Loads its row-advance/count/column from the lane-parameter
 * block (arm-10 triple at ACTIVE_LANE_PARAM_BLOCK + 30), stashes the column stride + tile source, then
 * calls the shared render loop directly with this arm's dest/source/cursors. LIVE-OUT: memory-only.
 */
import {
  ACTIVE_LANE_PARAM_BLOCK,
  SCROLL_COPY_COLUMN_STRIDE,
  SCROLL_COPY_SRC_PTR,
  LANE_OBJLIST_815A,
  FROG_ANIM_ARM10_DEST_PTR,
  FROG_ANIM_ARM10_SRC_BASE,
} from "./names.js";
import { renderFrogAnimTileColumns } from "./renderFrogAnimTileColumns.js";

export function renderFrogAnimArm10(m) {
  const { mem8, mem16 } = m;

  const rowAdvance = mem8[ACTIVE_LANE_PARAM_BLOCK + 30];
  const rowCount = mem8[ACTIVE_LANE_PARAM_BLOCK + 31];
  const columnIndex = mem8[ACTIVE_LANE_PARAM_BLOCK + 32];
  const destPtr = mem16[FROG_ANIM_ARM10_DEST_PTR];

  mem8[SCROLL_COPY_COLUMN_STRIDE] = rowAdvance;
  mem16[SCROLL_COPY_SRC_PTR] = FROG_ANIM_ARM10_SRC_BASE;

  return renderFrogAnimTileColumns(m, rowCount, columnIndex, destPtr, FROG_ANIM_ARM10_SRC_BASE, LANE_OBJLIST_815A, LANE_OBJLIST_815A);
}
