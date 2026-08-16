// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimArm6 — frog-animation arm 6: arm the shared render loop for this sprite, then enter it.
 * Reads the arm's triple, points the cursors and pattern pointer, stashes code and source where the
 * render loop rereads them, then runs it. LIVE-OUT: memory-only.
 */
import { FROG_ANIM_ARM6_SPRITE_CODE, FROG_ANIM_ARM6_ROW_COUNT, FROG_ANIM_ARM6_PASS_COUNT, FROG_ANIM_ARM6_DEST_PTR, FROG_ANIM_ARM6_SRC_BASE, LANE_OBJLIST_8136, SCROLL_COPY_COLUMN_STRIDE, SCROLL_COPY_SRC_PTR } from "./names.js";

const RENDER_LOOP = 0x0ff1;

export function renderFrogAnimArm6(m) {
  const { regs, mem8, mem16 } = m;

  regs.a = mem8[FROG_ANIM_ARM6_SPRITE_CODE];
  regs.b = mem8[FROG_ANIM_ARM6_ROW_COUNT];
  regs.c = mem8[FROG_ANIM_ARM6_PASS_COUNT];
  regs.hl = mem16[FROG_ANIM_ARM6_DEST_PTR];
  regs.de = FROG_ANIM_ARM6_SRC_BASE;
  regs.ix = LANE_OBJLIST_8136;
  regs.iy = LANE_OBJLIST_8136;

  mem8[SCROLL_COPY_COLUMN_STRIDE] = regs.a;
  mem16[SCROLL_COPY_SRC_PTR] = regs.de;

  return m.call(RENDER_LOOP);
}
