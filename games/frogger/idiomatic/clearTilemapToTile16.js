// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearTilemapToTile16 — the rst 0x38 primitive: clear the 32x32 tilemap to the blank tile 16.
 * Fills 1024 contiguous cells from the VRAM base; the per-row busy delay is timing-only. LIVE-OUT: memory-only.
 */
import { VRAM_BASE } from "./names.js";

const FILL_TILE = 0x10;
const TILEMAP_CELLS = 0x400;

export function clearTilemapToTile16(m) {
  const { mem8 } = m;
  for (let i = 0; i < TILEMAP_CELLS; i++) mem8[(VRAM_BASE + i)] = FILL_TILE;
}
