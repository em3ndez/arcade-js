// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1058 — a frog-animation render arm. Runs the guarded pre-blit, loads this arm's sprite
 * triple and pattern pointers, arms the plot cursors, then hands off to the shared render loop.
 * LIVE-OUT: memory-only.
 */
import { loc_8273, loc_13ef, loc_8109, loc_81b1, loc_8001, loc_1423 } from "./names.js";
import { blitFrogAnimColumnOnTrigger } from "./blitFrogAnimColumnOnTrigger.js";

const RENDER_LOOP = 0x0ff1; // shared frog-anim tile render loop, not yet idiomatized

export function loc_1058(m) {
  const { regs, mem8, mem16 } = m;

  blitFrogAnimColumnOnTrigger(m);

  const spriteCode = mem8[loc_8273];
  const rowCount = mem8[(loc_8273 + 1) & 0xffff];
  const columnIndex = mem8[(loc_8273 + 2) & 0xffff];

  mem8[loc_81b1] = spriteCode;
  mem16[loc_8001] = loc_1423;

  regs.a = spriteCode;
  regs.b = rowCount;
  regs.c = columnIndex;
  regs.hl = mem16[loc_13ef];
  regs.de = loc_1423;
  regs.ix = loc_8109;
  regs.iy = loc_8109;
  return m.call(RENDER_LOOP);
}
