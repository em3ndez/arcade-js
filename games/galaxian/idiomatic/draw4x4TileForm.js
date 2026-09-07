// SPDX-License-Identifier: GPL-3.0-only
/**
 * draw4x4TileForm (ROM 0x215f) -- draw one of three 4x4-tile indicator forms at a fixed VRAM region.
 *
 * WHAT IT IS
 *   Channel 2 of the display-list drain. The command argument (register A) selects the form:
 *     form 0 -> blank the 4x4 block then overlay a small 2x2 icon (blank4x4AndDraw2x2Icon);
 *     form 1 -> just blank the 4x4 block (blankTileBlock4x4);
 *     any other form -> fold (form-2) into a tile code and stamp four 2x2 tile blocks across the four
 *                       corners of the region.
 *   The four corner anchors loc_51da / loc_51dc / loc_521a / loc_521c are the VRAM cell addresses of a
 *   contiguous 4x4-cell region; the tile seed advances four codes per 2x2 block, so drawTileBlock2x2's
 *   returned seed (next.a) is threaded into the following block.
 *
 * ROLE IN THE MACHINE
 *   The larger fixed-position indicator painter of the tile-figure draw kit (the formation/indicator
 *   graphics), reached from decodeDisplayListSlotAndDispatch when a channel-2 command is drained.
 *
 * ROM 0x215f.  Grounding: [seen] (names.js cert for 0x215f).
 *
 * LIVE-OUT: the 4x4 VRAM region; on the multi-block path, whatever drawTileBlock2x2 leaves for the last
 * corner (its next-seed state).
 */
import { blank4x4AndDraw2x2Icon } from "./blank4x4AndDraw2x2Icon.js";
import { blankTileBlock4x4 } from "./blankTileBlock4x4.js";
import { drawTileBlock2x2 } from "./drawTileBlock2x2.js";
import { loc_51da, loc_51dc, loc_521a, loc_521c } from "./names.js";

export function draw4x4TileForm(m, form = m.regs.a) {
  // form 0: blank the 4x4 block, then overlay a small 2x2 icon.
  if (form === 0) return blank4x4AndDraw2x2Icon(m);
  // form 1: just blank the whole 4x4 block, nothing overlaid.
  if (form === 1) return blankTileBlock4x4(m);

  // Fold (form - 2) into the tile code's mid bits, complemented, masked to 0x30, over the fixed 0xc0
  // high base -- the starting tile code for the four stamped 2x2 blocks.
  const tile = (~(((form - 2) << 4) & 0xff) & 0x30) + 0xc0;

  // Stamp the four corners in turn; each block seeds the next from the returned code (+4 per block),
  // so the four 2x2 blocks paint a coherent 4x4 form across the contiguous cell region.
  let next = drawTileBlock2x2(m, tile, loc_51da);
  next = drawTileBlock2x2(m, next.a, loc_51dc);
  next = drawTileBlock2x2(m, next.a, loc_521a);
  return drawTileBlock2x2(m, next.a, loc_521c);
}
