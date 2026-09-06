// SPDX-License-Identifier: GPL-3.0-only
// Draw one of three indicator forms selected by `form`: form 0 blanks the block and overlays the
// icon; form 1 just blanks the block; otherwise fold the form index into a tile code and stamp four
// 2x2 tile blocks across the indicator's four corners, the seed advancing four codes per block.
import { blank4x4AndDraw2x2Icon } from "./blank4x4AndDraw2x2Icon.js";
import { blankTileBlock4x4 } from "./blankTileBlock4x4.js";
import { drawTileBlock2x2 } from "./drawTileBlock2x2.js";
import { loc_51da, loc_51dc, loc_521a, loc_521c } from "./names.js";

export function draw4x4TileForm(m, form = m.regs.a) {
  if (form === 0) return blank4x4AndDraw2x2Icon(m);
  if (form === 1) return blankTileBlock4x4(m);

  // Fold (form - 2) into the tile code's mid bits, complemented, over a fixed high base.
  const tile = (~(((form - 2) << 4) & 0xff) & 0x30) + 0xc0;

  let next = drawTileBlock2x2(m, tile, loc_51da);
  next = drawTileBlock2x2(m, next.a, loc_51dc);
  next = drawTileBlock2x2(m, next.a, loc_521a);
  return drawTileBlock2x2(m, next.a, loc_521c);
}
