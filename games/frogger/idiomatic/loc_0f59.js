// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0f59 — redraw one status line: clear its tile-group column, then stamp a 9-tile string.
 * LIVE-OUT: memory-only.
 */
import { loc_a850, loc_aa70, loc_2f0e } from "./names.js";
import { blitFourTileGroupColumn } from "./blitFourTileGroupColumn.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";

export function loc_0f59(m) {
  const { regs } = m;

  regs.hl = loc_a850;
  blitFourTileGroupColumn(m);

  copyRunUpTileColumn(m, loc_aa70, loc_2f0e, 9);
}
