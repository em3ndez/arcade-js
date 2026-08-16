// SPDX-License-Identifier: GPL-3.0-only
/**
 * blitEndStripAndSetHold — the no-more-frogs tail. Blits a 4-tile strip then a 5-tile strip up the same VRAM
 * column (the second continues where the first left the destination), then raises the hold flag.
 * LIVE-OUT: memory-only.
 */
import { NO_MORE_FROGS_COLUMN_VRAM, LAYOUT_SETUP_STRIP_SRC, FIVE_TILE_STRIP_SRC, HOLD_FLAG } from "./names.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";

export function blitEndStripAndSetHold(m) {
  const { regs, mem8 } = m;

  copyRunUpTileColumn(m, NO_MORE_FROGS_COLUMN_VRAM, LAYOUT_SETUP_STRIP_SRC, 4);
  copyRunUpTileColumn(m, regs.hl, FIVE_TILE_STRIP_SRC, 5);

  mem8[HOLD_FLAG] = 1;
}
