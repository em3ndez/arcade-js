// SPDX-License-Identifier: GPL-3.0-only
//
// drawTileBlock2x2 -- stamp a 2x2 square of four consecutive tile codes into the tilemap.
//
// WHAT IT IS
//   A block writer built on top of stampTilePair (ROM 0x25a0, imported here as loc_25a0). From the seed
//   tile in A it lays a top pair (tile, tile+1) at HL, then a bottom pair (tile+2, tile+3) one tilemap
//   row (+32 cells) directly below, forming a 2x2 square of the four codes tile..tile+3. DE is preserved.
//
// ROLE IN THE MACHINE
//   The 2x2 stamp primitive of the tile-drawing kit. stampTilePair writes a code and code+1 into two
//   adjacent cells, advances the pointer by a caller-supplied stride, and bumps the tile code by two.
//   Calling it twice with ROW_STRIDE makes the second pair land exactly one row under the first. It is
//   the block used by the figure/indicator painters (e.g. draw4x4TileForm, drawTileBlock2x2AtDe).
//
//   ROM 0x2585.  Grounding: [seen].
//
// LIVE-OUT: four tile codes written as a 2x2 block at HL; returns the advanced {a, hl}; DE unchanged.
import { stampTilePair as loc_25a0 } from "./stampTilePair.js";

// Stride so each pair advances +1 (past the pair) then +31 = +32, one tile row down.
const ROW_STRIDE = 31;

export function drawTileBlock2x2(m, tile = m.regs.a, dst = m.regs.hl) {
  // Top pair (tile, tile+1) at HL; stampTilePair advances the pointer by +32 and the code by +2.
  const top = loc_25a0(m, tile, dst, ROW_STRIDE);
  // Bottom pair (tile+2, tile+3) one row below, using the advanced code/pointer stampTilePair handed back.
  return loc_25a0(m, top.a, top.hl, ROW_STRIDE);
}
