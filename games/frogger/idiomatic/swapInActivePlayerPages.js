// SPDX-License-Identifier: GPL-3.0-only
/**
 * swapInActivePlayerPages — swap the active player's work pages IN for player 1; any other player tails to swap-OUT.
 *
 * For player 1: bank the two live pages into one save area, restore this player's pages from another,
 * and write the per-column object-attribute shadow byte. Any other player number tails to the swap-OUT path instead.
 * LIVE-OUT: memory-only.
 */
import { ACTIVE_PLAYER, LIVE_OBJECT_PAGE, OTHER_PLAYER_OBJECT_PAGE, LANE_OBJECT_INDEX, OTHER_PLAYER_WORK_PAGE, OBJECT_PAGE_SAVE_BANK, OBJRAM_COL3F_ATTR_SHADOW, WORK_PAGE_SAVE_BANK } from "./names.js";
import { swapOutActivePlayerPages } from "./swapOutActivePlayerPages.js";

const PLAYER_ONE = 1;
const PAGE_BYTES = 183;
const OBJECT_BYTES = 43;

function copy(mem8, dst, src, n) {
  for (let i = 0; i < n; i++) mem8[dst + i] = mem8[src + i];
}

export function swapInActivePlayerPages(m) {
  const { mem8 } = m;
  if (mem8[ACTIVE_PLAYER] !== PLAYER_ONE) return swapOutActivePlayerPages(m);

  copy(mem8, OTHER_PLAYER_OBJECT_PAGE, LIVE_OBJECT_PAGE, OBJECT_BYTES);
  copy(mem8, OTHER_PLAYER_WORK_PAGE, LANE_OBJECT_INDEX, PAGE_BYTES);
  copy(mem8, LIVE_OBJECT_PAGE, OBJECT_PAGE_SAVE_BANK, OBJECT_BYTES);
  mem8[OBJRAM_COL3F_ATTR_SHADOW] = 1;
  copy(mem8, LANE_OBJECT_INDEX, WORK_PAGE_SAVE_BANK, PAGE_BYTES);
}
