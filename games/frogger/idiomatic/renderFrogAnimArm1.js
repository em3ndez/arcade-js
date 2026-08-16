// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimArm1 — a frog-animation render arm. Runs the guarded pre-blit, loads this arm's sprite
 * triple and pattern pointers, arms the plot cursors, then hands off to the shared render loop.
 * LIVE-OUT: memory-only.
 */
import { SCROLL_OBJECT_BLOCK_BASE, SCROLL_COPY_DEST_PTR, LANE_OBJLIST_8109, SCROLL_COPY_COLUMN_STRIDE, SCROLL_COPY_SRC_PTR, SCROLL_GRID_SRC_PHASE16 } from "./names.js";
import { blitFrogAnimColumnOnTrigger } from "./blitFrogAnimColumnOnTrigger.js";

const RENDER_LOOP = 0x0ff1; // shared frog-anim tile render loop, not yet idiomatized

export function renderFrogAnimArm1(m) {
  const { regs, mem8, mem16 } = m;

  blitFrogAnimColumnOnTrigger(m);

  const spriteCode = mem8[SCROLL_OBJECT_BLOCK_BASE];
  const rowCount = mem8[(SCROLL_OBJECT_BLOCK_BASE + 1) & 0xffff];
  const columnIndex = mem8[(SCROLL_OBJECT_BLOCK_BASE + 2) & 0xffff];

  mem8[SCROLL_COPY_COLUMN_STRIDE] = spriteCode;
  mem16[SCROLL_COPY_SRC_PTR] = SCROLL_GRID_SRC_PHASE16;

  regs.a = spriteCode;
  regs.b = rowCount;
  regs.c = columnIndex;
  regs.hl = mem16[SCROLL_COPY_DEST_PTR];
  regs.de = SCROLL_GRID_SRC_PHASE16;
  regs.ix = LANE_OBJLIST_8109;
  regs.iy = LANE_OBJLIST_8109;
  return m.call(RENDER_LOOP);
}
