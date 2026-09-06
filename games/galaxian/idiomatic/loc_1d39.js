// SPDX-License-Identifier: GPL-3.0-only
// First half of the tile-strip fill: stamp `count` two-tile pairs from the VRAM cursor forward (two cells
// per pass, count 0 wraps to 256), then hand the advanced cursor to the second half, which stamps a fixed
// 16 more pairs and ticks the strip-redraw countdown.
import { u16 } from "../../../core/int.js";
import { drawScreenFillStripSecondHalf } from "./drawScreenFillStripSecondHalf.js";

const STRIP_TILE_A = 48;
const STRIP_TILE_B = 50;
const SECOND_HALF_PAIRS = 16;

export function loc_1d39(m, cursor = m.regs.hl, count = m.regs.b) {
  const { mem8 } = m;

  let ptr = cursor;
  let remaining = count;
  do {
    mem8[ptr] = STRIP_TILE_A;
    ptr = u16(ptr + 1);
    mem8[ptr] = STRIP_TILE_B;
    ptr = u16(ptr + 1);
    remaining = (remaining - 1) & 0xff;
  } while (remaining !== 0);

  return drawScreenFillStripSecondHalf(m, ptr, SECOND_HALF_PAIRS);
}
