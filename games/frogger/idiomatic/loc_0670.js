// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0670 — stamp all five home-slot markers, then tail into the extra-life award.
 * Stamps each slot's 2x2 marker from its VRAM base via the shared stamp routine, clears the
 * home-column state cell, then hands off to the award routine (whose result it returns).
 * LIVE-OUT: memory-only.
 */
import { loc_ab64, loc_aaa4, loc_a9e4, loc_a924, loc_a864, loc_842f } from "./names.js";
import { fillTwoByTwoTileBlock } from "./fillTwoByTwoTileBlock.js";
import { awardExtraLife } from "./awardExtraLife.js";

export function loc_0670(m) {
  const { mem8 } = m;

  fillTwoByTwoTileBlock(m, loc_ab64);
  fillTwoByTwoTileBlock(m, loc_aaa4);
  fillTwoByTwoTileBlock(m, loc_a9e4);
  fillTwoByTwoTileBlock(m, loc_a924);
  fillTwoByTwoTileBlock(m, loc_a864);

  mem8[loc_842f] = 0;
  return awardExtraLife(m);
}
