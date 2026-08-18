// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimArm4 — frog-animation arm 4. Loads its row-advance/count/column from the lane-parameter
 * block (arm-4 triple at ACTIVE_LANE_PARAM_BLOCK + 12), stashes the column stride + tile source, then
 * calls the shared render loop directly with this arm's dest/source/cursors. Its pointer cells already
 * carry the scroll subsystem's names (shared block). LIVE-OUT: memory-only.
 */
import {
  ACTIVE_LANE_PARAM_BLOCK,
  SCROLL_COPY_COLUMN_STRIDE,
  SCROLL_COPY_SRC_PTR,
  LANE_OBJLIST_8124,
  SCROLL_COPY_DEST_PTR_ALT,
  SCROLL_BAND_SRC_PHASE16,
} from "./names.js";
import { renderFrogAnimTileColumns } from "./renderFrogAnimTileColumns.js";

export function renderFrogAnimArm4(m) {
  const { mem8, mem16 } = m;

  const rowAdvance = mem8[ACTIVE_LANE_PARAM_BLOCK + 12];
  const rowCount = mem8[ACTIVE_LANE_PARAM_BLOCK + 13];
  const columnIndex = mem8[ACTIVE_LANE_PARAM_BLOCK + 14];
  const destPtr = mem16[SCROLL_COPY_DEST_PTR_ALT];

  mem8[SCROLL_COPY_COLUMN_STRIDE] = rowAdvance;
  mem16[SCROLL_COPY_SRC_PTR] = SCROLL_BAND_SRC_PHASE16;

  return renderFrogAnimTileColumns(m, rowCount, columnIndex, destPtr, SCROLL_BAND_SRC_PHASE16, LANE_OBJLIST_8124, LANE_OBJLIST_8124);
}
