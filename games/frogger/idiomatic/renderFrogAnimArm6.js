// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimArm6 — frog-animation arm 6: arm the shared render loop for this sprite, then enter it.
 * Reads the arm's triple, points the cursors and pattern pointer, stashes code and source where the
 * render loop rereads them, then runs it. LIVE-OUT: memory-only.
 */
import { loc_8282, loc_8283, loc_8284, loc_13f9, loc_149f, loc_8136, loc_81b1, loc_8001 } from "./names.js";

const RENDER_LOOP = 0x0ff1;

export function renderFrogAnimArm6(m) {
  const { regs, mem8, mem16 } = m;

  regs.a = mem8[loc_8282];
  regs.b = mem8[loc_8283];
  regs.c = mem8[loc_8284];
  regs.hl = mem16[loc_13f9];
  regs.de = loc_149f;
  regs.ix = loc_8136;
  regs.iy = loc_8136;

  mem8[loc_81b1] = regs.a;
  mem16[loc_8001] = regs.de;

  return m.call(RENDER_LOOP);
}
