// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { PANEL_TILE_SOURCE, PANEL_VRAM_DEST } from "./names.js";

const TILE_BLANK = 0x40; // tile painted for an empty (zero) source cell

/**
 * renderPanelFromTable — paint the status panel from its tile-code table.
 *
 * Walks ten rows of three cells: each source byte is painted when non-zero, else the blank
 * tile. Within a row the first two cells climb one row (stride -0x20); the third re-bases
 * forward to the next column (+0x42). Reads the table, writes VRAM; calls nothing.
 *
 * LIVE-OUT: memory only (the painted panel); returns nothing.
 */
export function renderPanelFromTable(m) {
  const { mem8 } = m;
  let src = PANEL_TILE_SOURCE;
  let dst = PANEL_VRAM_DEST;

  for (let row = 0x0a; row !== 0; row--) {
    for (let cell = 0; cell < 3; cell++) {
      const code = mem8[src];
      mem8[dst] = code !== 0 ? code : TILE_BLANK;
      src = u16(src + 1);
      dst = cell < 2 ? u16(dst - 0x20) : u16(dst + 0x42);
    }
  }
}
