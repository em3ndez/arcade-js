// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimArm6 — frog-animation arm 6: arm the shared render loop for this sprite, then enter it.
 * Reads the arm's triple, points the cursors and pattern pointer, stashes code and source where the
 * render loop rereads them, then runs it. LIVE-OUT: memory-only.
 */
import { FROG_ANIM_ARM6_SPRITE_CODE, loc_8283, loc_8284, loc_13f9, loc_149f, LANE_OBJLIST_8136, loc_81b1, SCROLL_COPY_SRC_PTR } from "./names.js";

const RENDER_LOOP = 0x0ff1;

export function renderFrogAnimArm6(m) {
  const { regs, mem8, mem16 } = m;

  regs.a = mem8[FROG_ANIM_ARM6_SPRITE_CODE];
  regs.b = mem8[loc_8283];
  regs.c = mem8[loc_8284];
  regs.hl = mem16[loc_13f9];
  regs.de = loc_149f;
  regs.ix = LANE_OBJLIST_8136;
  regs.iy = LANE_OBJLIST_8136;

  mem8[loc_81b1] = regs.a;
  mem16[SCROLL_COPY_SRC_PTR] = regs.de;

  return m.call(RENDER_LOOP);
}
