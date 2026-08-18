// SPDX-License-Identifier: GPL-3.0-only
/**
 * blitMode3FinalStrip — the mode-3 score-ranking screen's final-strip tail. Zeros the mode-3 strip
 * state cell, then blits a 15-tile strip up a fixed VRAM column (destination steps up one tilemap
 * row per byte as the source advances). Reached by fall-through from the score render and by a
 * direct jump once the mode is already set up. LIVE-OUT: the zeroed cell and the blitted column.
 */
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";
import { MODE3_STRIP_STATE, MODE3_FINAL_STRIP_VRAM, MODE3_FINAL_STRIP_SRC } from "./names.js";

const FINAL_STRIP_LEN = 0x0f;

export function blitMode3FinalStrip(m) {
  const { mem8 } = m;

  mem8[MODE3_STRIP_STATE] = 0;
  copyRunUpTileColumn(m, MODE3_FINAL_STRIP_VRAM, MODE3_FINAL_STRIP_SRC, FINAL_STRIP_LEN);
}
