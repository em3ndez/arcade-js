// SPDX-License-Identifier: GPL-3.0-only

/**
 * blankTileBlock4x4 (ROM 0x2187) — blank a 4x4 tile block in tilemap VRAM.
 *
 * WHAT IT IS
 *   Writes the blank-tile code (0x40) into a 4x4 square of tilemap cells anchored at loc_51da, stepping one
 *   full row stride (32 cells) between successive row starts.
 *
 * ROLE IN THE MACHINE
 *   A render primitive under the channel-2 4x4-form draw handler draw4x4TileForm (0x215f): form 1 calls it
 *   to blank the region, and form 0 (blank4x4AndDraw2x2Icon, 0x219b) calls it before overlaying a 2x2 icon.
 *   loc_51da is the block's top-left VRAM cell; the +32 ROW_STEP is the tilemap's cell-to-cell distance
 *   between one tile row and the next, so `loc_51da + row*32 + col` addresses each cell of the block.
 *
 * ROM 0x2187.  Grounding: [seen].
 *
 * LIVE-OUT: memory only — the sixteen tilemap cells of the 4x4 block at loc_51da set to the blank tile (0x40).
 */
import { loc_51da } from "./names.js";

const BLANK_TILE = 0x40;
const SIDE = 4;       // 4x4 block
const ROW_STEP = 32;  // start-to-start stride between rows

export function blankTileBlock4x4(m) {
  const { mem8 } = m;

  // Walk the four rows: each row starts one ROW_STEP (32 cells) further into VRAM than the last, and each
  // inner pass stamps the blank tile into the four consecutive cells of that row.
  for (let row = 0; row < SIDE; row++) {
    const base = loc_51da + row * ROW_STEP;
    for (let col = 0; col < SIDE; col++) mem8[base + col] = BLANK_TILE;
  }
}
