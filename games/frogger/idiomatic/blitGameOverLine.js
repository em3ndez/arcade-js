// SPDX-License-Identifier: GPL-3.0-only
/**
 * blitGameOverLine — redraw one status line: clear its tile-group column, then stamp a 9-tile string.
 * LIVE-OUT: memory-only.
 */
import { STATUS_ROW_VRAM_BASE, NINE_TILE_STRING_VRAM, loc_2f0e } from "./names.js";
import { blitFourTileGroupColumn } from "./blitFourTileGroupColumn.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";

export function blitGameOverLine(m) {
  const { regs } = m;

  regs.hl = STATUS_ROW_VRAM_BASE;
  blitFourTileGroupColumn(m);

  copyRunUpTileColumn(m, NINE_TILE_STRING_VRAM, loc_2f0e, 9);
}
