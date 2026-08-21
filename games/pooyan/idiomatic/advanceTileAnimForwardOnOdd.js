// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { TILE_ANIM_CURSOR, TILE_ANIM_PARITY } from "./names.js";
/**
 * advanceTileAnimForwardOnOdd — on odd frames, step the tilemap animation forward one cell.
 *
 * Bumps the parity tick every call and acts only when it turns odd (the even-frame twin walks the
 * cursor the other way). When it acts: if the tile code under the cursor has reached the wrap code,
 * step the cursor forward one cell and reseed it; otherwise animate the current cell's tile code up
 * by one. The advanced cursor is stored back. A leaf — writes only these cells, calls nothing.
 *
 * LIVE-OUT: memory only (the parity tick, the cursor, and one tilemap cell). Returns nothing.
 */

const TILE_ANIM_WRAP = 0x37;  // at/above this tile code the cursor steps forward and reseeds
const TILE_ANIM_SEED = 0x34;  // tile code stamped into the freshly-entered cell

export function advanceTileAnimForwardOnOdd(m) {
  const { mem8, mem16 } = m;

  mem8[TILE_ANIM_PARITY] = mem8[TILE_ANIM_PARITY] + 1;
  if ((mem8[TILE_ANIM_PARITY] & 1) === 0) return; // even frame: nothing to do here

  let cursor = mem16[TILE_ANIM_CURSOR];
  if (mem8[cursor] >= TILE_ANIM_WRAP) {
    cursor = u16(cursor + 1);
    mem8[cursor] = TILE_ANIM_SEED;
  } else {
    mem8[cursor] = mem8[cursor] + 1;
  }
  mem16[TILE_ANIM_CURSOR] = cursor;
}
