// SPDX-License-Identifier: GPL-3.0-only
/**
 * swapOutActivePlayerPages — swap the active player's work pages OUT: bank the live pages, restore the other bank.
 *
 * Saves the two live work pages into one bank, restores them from another, writes the per-column
 * object-attribute shadow byte, then — unless the init latch is already set — clears one cell and latches it.
 * LIVE-OUT: memory-only.
 */
import {
  LANE_OBJECT_INDEX, loc_8500, LIVE_OBJECT_PAGE, loc_86c0, OTHER_PLAYER_WORK_PAGE, OTHER_PLAYER_OBJECT_PAGE,
  OBJRAM_COL3F_ATTR_SHADOW, loc_8295, TWO_PLAYER_START_FLAG,
} from "./names.js";

const PAGE_BYTES = 183;
const OBJECT_BYTES = 43;

function copy(mem8, dst, src, n) {
  for (let i = 0; i < n; i++) mem8[dst + i] = mem8[src + i];
}

export function swapOutActivePlayerPages(m) {
  const { mem8 } = m;
  copy(mem8, loc_8500, LANE_OBJECT_INDEX, PAGE_BYTES);
  copy(mem8, loc_86c0, LIVE_OBJECT_PAGE, OBJECT_BYTES);
  copy(mem8, LANE_OBJECT_INDEX, OTHER_PLAYER_WORK_PAGE, PAGE_BYTES);
  copy(mem8, LIVE_OBJECT_PAGE, OTHER_PLAYER_OBJECT_PAGE, OBJECT_BYTES);
  mem8[OBJRAM_COL3F_ATTR_SHADOW] = 1;
  if (mem8[loc_8295] !== 0) return;
  mem8[TWO_PLAYER_START_FLAG] = 0;
  mem8[loc_8295] = 1;
}
