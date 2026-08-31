// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { blitTile3x3Block } from "./blitTile3x3Block.js";
import {
  ROUND_COUNTER,
  SPAWN_PHASE_COUNTER,
  SPAWN_PHASE_SNAPSHOT,
  ROPE_DRAW_COUNT,
  MARKER_LAYOUT_PTR,
  MARKER_VRAM_BASE,
  MARKER_GLYPH_SRC,
} from "./names.js";
/**
 * paintSpawnPhaseMarkerColumn — draw the round marker. Gated on the round counter's low bit: when clear it returns.
 * Otherwise it snapshots the spawn-phase count into two mirror cells, then renders the marker: for a
 * nonzero count it paints that many stacked pairs of a two-wide marker down a tilemap column, saves
 * the column layout pointer, and stamps the marker glyph block below it; for a zero count it saves
 * the alternate layout pointer and stamps the glyph block at the fixed anchor.
 * LIVE-OUT: memory only — the snapshot cells, the saved layout pointer, and the painted tiles. The
 * advanced tile pointers the glyph blitter leaves in HL/DE are not consumed by any caller.
 */

const TILE_MARKER_TL = 0xda;
const TILE_MARKER_TR = 0xdb;
const TILE_MARKER_BL = 0xd8;
const TILE_MARKER_BR = 0xd9;
const MARKER_ROW_STRIDE = 0x20;
const MARKER_TAIL_OFFSET = 0x41;

export function paintSpawnPhaseMarkerColumn(m) {
  const { mem8, mem16 } = m;

  if ((mem8[ROUND_COUNTER] & 0x01) === 0) return; // feature bit clear

  const count = mem8[SPAWN_PHASE_COUNTER];
  mem8[SPAWN_PHASE_SNAPSHOT] = count;
  mem8[ROPE_DRAW_COUNT] = count;

  if (count !== 0) {
    mem16[MARKER_LAYOUT_PTR] = MARKER_VRAM_BASE - MARKER_ROW_STRIDE;
    let cell = MARKER_VRAM_BASE;
    let row = count;
    do {
      mem8[cell] = TILE_MARKER_TL;
      mem8[cell + 1] = TILE_MARKER_TR;
      const lower = cell - MARKER_ROW_STRIDE;
      mem8[lower] = TILE_MARKER_BL;
      mem8[lower + 1] = TILE_MARKER_BR;
      cell = lower - MARKER_ROW_STRIDE;
      row -= 1;
    } while (row !== 0);
    blitTile3x3Block(m, u16(cell - MARKER_TAIL_OFFSET), MARKER_GLYPH_SRC);
    return;
  }

  mem16[MARKER_LAYOUT_PTR] = MARKER_VRAM_BASE + MARKER_ROW_STRIDE;
  blitTile3x3Block(m, MARKER_VRAM_BASE - MARKER_TAIL_OFFSET, MARKER_GLYPH_SRC);
}
