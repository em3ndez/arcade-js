// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillColorRam — repaint every colour-RAM cell with one board-mode colour byte.
 *
 * The playfield's per-tile colour comes from a 1024-cell colour RAM the video hardware reads
 * alongside the tile map. This routine paints that entire region a single flat colour: it takes
 * the one board-mode byte held at BOARD_MODE and stamps it into all 1024 cells, so the whole
 * screen switches to one palette index in one pass. Used at board setup to recolour the field for
 * the current board. The fill byte is read once, so every cell gets the same value.
 */
import { BOARD_MODE } from "./names.js";

const COLOR_RAM_BASE = 0x8800;
const COLOR_RAM_CELLS = 1024; // the whole per-tile colour RAM

export function fillColorRam(m) {
  const { mem8 } = m;
  const fill = mem8[BOARD_MODE];
  for (let cell = 0; cell < COLOR_RAM_CELLS; cell++) {
    mem8[COLOR_RAM_BASE + cell] = fill;
  }
}
