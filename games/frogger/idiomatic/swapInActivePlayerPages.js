// SPDX-License-Identifier: GPL-3.0-only
/**
 * swapInActivePlayerPages — swap the active player's work pages IN for player 1; any other player tails to swap-OUT.
 *
 * For player 1: bank the two live pages into one save area, restore this player's pages from another,
 * and raise the swap-done flag. Any other player number tails to the swap-OUT path instead.
 * LIVE-OUT: memory-only.
 */
import { loc_83fd, loc_800c, loc_85c0, loc_80ff, loc_8600, loc_86c0, loc_803f, loc_8500 } from "./names.js";
import { swapOutActivePlayerPages } from "./swapOutActivePlayerPages.js";

const PLAYER_ONE = 1;
const PAGE_BYTES = 183;
const OBJECT_BYTES = 43;

function copy(mem8, dst, src, n) {
  for (let i = 0; i < n; i++) mem8[dst + i] = mem8[src + i];
}

export function swapInActivePlayerPages(m) {
  const { mem8 } = m;
  if (mem8[loc_83fd] !== PLAYER_ONE) return swapOutActivePlayerPages(m);

  copy(mem8, loc_85c0, loc_800c, OBJECT_BYTES);
  copy(mem8, loc_8600, loc_80ff, PAGE_BYTES);
  copy(mem8, loc_800c, loc_86c0, OBJECT_BYTES);
  mem8[loc_803f] = 1;
  copy(mem8, loc_80ff, loc_8500, PAGE_BYTES);
}
