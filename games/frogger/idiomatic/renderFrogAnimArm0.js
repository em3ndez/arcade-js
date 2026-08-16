// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimArm0 — frog-animation arm 0, a sibling of the arm-1 and arm-6 handlers. Loads its
 * row-advance, row-count and column-index from the lane-parameter block, points the destination and
 * pattern pointers, arms the plot cursors, stashes the row-advance and tile source where the shared
 * render loop rereads them, then enters that loop. LIVE-OUT: memory-only.
 */
import { loc_8270, loc_81b1, SCROLL_COPY_SRC_PTR, SPRITE_BLOCK2_BASE } from "./names.js";

const RENDER_LOOP = 0x0ff1;   // shared render loop this arm enters
const DEST_PTR = 0x13ed;
const TILE_SOURCE = 0x1403;

export function renderFrogAnimArm0(m) {
  const { regs, mem8, mem16 } = m;

  const rowAdvance = mem8[loc_8270];
  regs.a = rowAdvance;
  regs.b = mem8[(loc_8270 + 1) & 0xffff];
  regs.c = mem8[(loc_8270 + 2) & 0xffff];
  regs.hl = mem16[DEST_PTR];
  regs.de = TILE_SOURCE;
  regs.ix = SPRITE_BLOCK2_BASE;
  regs.iy = SPRITE_BLOCK2_BASE;

  mem8[loc_81b1] = rowAdvance;
  mem16[SCROLL_COPY_SRC_PTR] = TILE_SOURCE;

  return m.call(RENDER_LOOP);
}
