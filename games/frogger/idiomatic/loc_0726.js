// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0726 — swap the active player's work pages OUT: bank the live pages, restore the other bank.
 *
 * Saves the two live work pages into one bank, restores them from another, sets the swap-done flag,
 * then — unless the init latch is already set — clears one cell and latches it.
 * LIVE-OUT: memory-only.
 */
import {
  loc_80ff, loc_8500, loc_800c, loc_86c0, loc_8600, loc_85c0,
  loc_803f, loc_8295, loc_825b,
} from "./names.js";

const PAGE_BYTES = 183;
const OBJECT_BYTES = 43;

function copy(mem8, dst, src, n) {
  for (let i = 0; i < n; i++) mem8[dst + i] = mem8[src + i];
}

export function loc_0726(m) {
  const { mem8 } = m;
  copy(mem8, loc_8500, loc_80ff, PAGE_BYTES);
  copy(mem8, loc_86c0, loc_800c, OBJECT_BYTES);
  copy(mem8, loc_80ff, loc_8600, PAGE_BYTES);
  copy(mem8, loc_800c, loc_85c0, OBJECT_BYTES);
  mem8[loc_803f] = 1;
  if (mem8[loc_8295] !== 0) return;
  mem8[loc_825b] = 0;
  mem8[loc_8295] = 1;
}
