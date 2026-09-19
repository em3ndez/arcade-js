// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillColumnAndContinueWalk — fill a tilemap column down from the current cursor with SEG_TILE,
 * paying SEG_HEIGHT 8 pixels per row, then step the record pointer and resume the layout walk.
 *
 * LIVE-OUT: memory plus the record pointer — the column extent, the tilemap, and whatever the
 * resumed walk draws.
 */
import { u16 } from "../../../core/int.js";
import { SEG_TILE, SEG_HEIGHT } from "./names.js";
import { drawBoardLayout } from "./drawBoardLayout.js";

export function fillColumnAndContinueWalk(m, hl = m.regs.hl, de = m.regs.de) {
  const { regs, mem8 } = m;

  const tile = mem8[SEG_TILE]; // loop-invariant, hoisted
  let addr = hl;
  for (;;) {
    mem8[addr] = tile;
    addr = u16(addr + 0x20); // step one whole tilemap row
    const height = mem8[SEG_HEIGHT];
    mem8[SEG_HEIGHT] = (height - 0x08);
    if (height < 0x08) break; // subtraction borrowed -> height spent, column done
  }

  regs.de = u16(de + 1);
  drawBoardLayout(m);
}
