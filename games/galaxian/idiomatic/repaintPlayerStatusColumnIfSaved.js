// SPDX-License-Identifier: GPL-3.0-only
// Repaint the player-status column, but only when the saved status byte is nonzero; a zero byte skips it.
import { repaintPlayerStatusColumn } from "./repaintPlayerStatusColumn.js";
import { loc_40ab } from "./names.js";

export function repaintPlayerStatusColumnIfSaved(m) {
  const { mem8 } = m;
  if (mem8[loc_40ab] === 0) return;
  return repaintPlayerStatusColumn(m);
}
