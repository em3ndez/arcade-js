// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillColorRam — repaint every colour-RAM cell with one board-mode colour byte.  ROM 0x4c37.
 *
 * The playfield's per-tile colour comes from a 1024-cell colour RAM the video
 * hardware reads alongside the tile map. This routine paints that entire region a
 * single flat colour: it takes the one board-mode byte held at BOARD_MODE and
 * stamps it into all 1024 cells, so the whole screen switches to one palette index
 * in one pass. Used at board setup to recolour the field for the current board.
 *
 * The fill byte is read once, so every cell gets the same value.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4c37.test.js.
 * GATE:     strict whole-machine unit (captured real dispatch) + crafted fill-byte
 *           sweep. Dispatched during boot/attract (first ~frame 1, 3x within 240).
 * LIVE-OUT: memory-only — the 1024 colour-RAM cells. No live registers: the tail
 *           successor (0x4c1c) overwrites the loop's leftover counter/pointer and
 *           reads none of the fill byte.
 * NAMES:    BOARD_MODE (0x8057 — the byte used here as the screen-wide fill colour).
 *           Colour RAM 0x8800..0x8bff is a fixed hardware region, kept as an address.
 */
import { BOARD_MODE } from "./ram.js";

const COLOR_RAM_BASE = 0x8800;
const COLOR_RAM_CELLS = 1024; // the whole per-tile colour RAM, 0x8800..0x8bff

export function fillColorRam(m) {
  const { mem } = m;
  const fill = mem.read8(BOARD_MODE);
  for (let cell = 0; cell < COLOR_RAM_CELLS; cell++) {
    mem.write8(COLOR_RAM_BASE + cell, fill);
  }
}
