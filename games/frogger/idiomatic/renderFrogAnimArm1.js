// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimArm1 — a frog-animation render arm. Runs the guarded pre-blit, loads this arm's sprite
 * triple and pattern pointers, stashes the column stride + tile source, then calls the shared render
 * loop directly with this arm's dest/source/cursors. LIVE-OUT: memory-only.
 */
import { SCROLL_OBJECT_BLOCK_BASE, SCROLL_COPY_DEST_PTR, LANE_OBJLIST_8109, SCROLL_COPY_COLUMN_STRIDE, SCROLL_COPY_SRC_PTR, SCROLL_GRID_SRC_PHASE16 } from "./names.js";
import { blitFrogAnimColumnOnTrigger } from "./blitFrogAnimColumnOnTrigger.js";
import { renderFrogAnimTileColumns } from "./renderFrogAnimTileColumns.js";

export function renderFrogAnimArm1(m) {
  const { mem8, mem16 } = m;

  blitFrogAnimColumnOnTrigger(m);

  const spriteCode = mem8[SCROLL_OBJECT_BLOCK_BASE];
  const rowCount = mem8[(SCROLL_OBJECT_BLOCK_BASE + 1)];
  const columnIndex = mem8[(SCROLL_OBJECT_BLOCK_BASE + 2)];

  mem8[SCROLL_COPY_COLUMN_STRIDE] = spriteCode;
  mem16[SCROLL_COPY_SRC_PTR] = SCROLL_GRID_SRC_PHASE16;

  return renderFrogAnimTileColumns(m, rowCount, columnIndex, mem16[SCROLL_COPY_DEST_PTR], SCROLL_GRID_SRC_PHASE16, LANE_OBJLIST_8109, LANE_OBJLIST_8109);
}
