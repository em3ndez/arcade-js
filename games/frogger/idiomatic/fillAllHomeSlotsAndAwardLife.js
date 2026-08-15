// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillAllHomeSlotsAndAwardLife — stamp all five home-slot markers, then tail into the extra-life award.
 * Stamps each slot's 2x2 marker from its VRAM base via the shared stamp routine, clears the
 * home-column state cell, then hands off to the award routine (whose result it returns).
 * LIVE-OUT: memory-only.
 */
import { HOME_SLOT1_VRAM, HOME_SLOT2_VRAM, HOME_SLOT3_VRAM, HOME_SLOT4_VRAM, HOME_SLOT5_VRAM, HOME_COLUMN_STATE } from "./names.js";
import { fillTwoByTwoTileBlock } from "./fillTwoByTwoTileBlock.js";
import { awardExtraLife } from "./awardExtraLife.js";

export function fillAllHomeSlotsAndAwardLife(m) {
  const { mem8 } = m;

  fillTwoByTwoTileBlock(m, HOME_SLOT1_VRAM);
  fillTwoByTwoTileBlock(m, HOME_SLOT2_VRAM);
  fillTwoByTwoTileBlock(m, HOME_SLOT3_VRAM);
  fillTwoByTwoTileBlock(m, HOME_SLOT4_VRAM);
  fillTwoByTwoTileBlock(m, HOME_SLOT5_VRAM);

  mem8[HOME_COLUMN_STATE] = 0;
  return awardExtraLife(m);
}
