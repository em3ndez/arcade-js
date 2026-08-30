// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { PANEL_TILE_SOURCE, PANEL_VRAM_DEST } from "./names.js";

const TILE_BLANK = 0x40; // tile painted for an empty (zero) source cell

/**
 * renderPanelFromTable — blit the status panel from its work-RAM tile-code table into VRAM. [seen]
 *
 * ROM 0x0460. The status panel (the fixed HUD block) is not drawn glyph-by-glyph by gameplay
 * code; instead other routines compose a small tile-code table in work RAM and this routine
 * copies it onto the screen each time the panel needs repainting. The source is
 * PANEL_TILE_SOURCE (0x8e00), a 30-byte table laid out as 10 rows of 3 cells; the destination
 * is PANEL_VRAM_DEST (0x8567), the panel's base in tilemap VRAM.
 *
 * Traversal order encodes the panel's on-screen geometry. VRAM addresses increase by 0x20 per
 * screen row (one tile row = 32 bytes), so:
 *   - within a row, the first two cells step the destination by -0x20, climbing UP the column
 *     one tile at a time;
 *   - the third cell instead re-bases by +0x42, jumping across to the base of the next column
 *     of the panel and one tile over, ready for the next row of three.
 * The source pointer simply advances +1 through the flat 30-byte table.
 *
 * Blanking rule: a source byte of 0 is treated as "empty" and painted with the blank tile
 * TILE_BLANK (0x40); any non-zero byte is written through unchanged.
 *
 * Reads the table, writes VRAM; calls nothing.
 *
 * LIVE-OUT: memory only — the painted panel in VRAM. Returns nothing.
 */
export function renderPanelFromTable(m) {
  const { mem8 } = m;
  // Source walks the flat 30-byte table; dest starts at the panel's VRAM base.
  let src = PANEL_TILE_SOURCE;
  let dst = PANEL_VRAM_DEST;

  // Ten rows (0x0a), counted down to zero — the outer djnz of the ROM loop.
  for (let row = 0x0a; row !== 0; row--) {
    // Three cells per row.
    for (let cell = 0; cell < 3; cell++) {
      // Fetch the source tile code; a zero cell paints the blank tile, otherwise paint as-is.
      const code = mem8[src];
      mem8[dst] = code !== 0 ? code : TILE_BLANK;
      // Advance the flat source pointer one byte.
      src = u16(src + 1);
      // First two cells climb the column (-0x20 = up one screen row); the third re-bases to the
      // next column start (+0x42), setting up the following row of three.
      dst = cell < 2 ? u16(dst - 0x20) : u16(dst + 0x42);
    }
  }
}
