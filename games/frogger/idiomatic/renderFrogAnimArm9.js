// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimArm9 — frog-animation arm 9. Loads its row-advance/count/column from the lane-parameter
 * block (arm-9 triple at ACTIVE_LANE_PARAM_BLOCK + 27), stashes the column stride + tile source, then
 * calls the shared render loop directly with this arm's dest/source/cursors. LIVE-OUT: memory-only.
 */
import {
  ACTIVE_LANE_PARAM_BLOCK,
  SCROLL_COPY_COLUMN_STRIDE,
  SCROLL_COPY_SRC_PTR,
  LANE_OBJLIST_8151,
  FROG_ANIM_ARM9_DEST_PTR,
  FROG_ANIM_ARM9_SRC_BASE,
} from "./names.js";
import { renderFrogAnimTileColumns } from "./renderFrogAnimTileColumns.js";

export function renderFrogAnimArm9(m) {
  const { mem8, mem16 } = m;

  const rowAdvance = mem8[ACTIVE_LANE_PARAM_BLOCK + 27];
  const rowCount = mem8[ACTIVE_LANE_PARAM_BLOCK + 28];
  const columnIndex = mem8[ACTIVE_LANE_PARAM_BLOCK + 29];
  const destPtr = mem16[FROG_ANIM_ARM9_DEST_PTR];

  mem8[SCROLL_COPY_COLUMN_STRIDE] = rowAdvance;
  mem16[SCROLL_COPY_SRC_PTR] = FROG_ANIM_ARM9_SRC_BASE;

  return renderFrogAnimTileColumns(m, rowCount, columnIndex, destPtr, FROG_ANIM_ARM9_SRC_BASE, LANE_OBJLIST_8151, LANE_OBJLIST_8151);
}
