// SPDX-License-Identifier: GPL-3.0-only
// One-shot per current player: index the per-player flag table by the active player; if this player's slot
// is already flagged, do nothing. Otherwise flag the slot, raise the sound-envelope trigger, bump the marker
// counter, and repaint the marker row with the new count.
import { drawMarkerRow } from "./drawMarkerRow.js";
import { CURRENT_PLAYER, loc_40ad, loc_41c7, loc_421d } from "./names.js";

export function loc_229c(m) {
  const { mem8 } = m;

  const flag = loc_40ad + mem8[CURRENT_PLAYER];
  if ((mem8[flag] & 1) !== 0) return;

  mem8[flag] = 1;
  mem8[loc_41c7] = 1;
  mem8[loc_421d]++;

  return drawMarkerRow(m, mem8[loc_421d]);
}
