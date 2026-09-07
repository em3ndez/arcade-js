// SPDX-License-Identifier: GPL-3.0-only
//
// stampTilePair -- ROM 0x25a0. Grounding: [seen].
//
// WHAT IT IS
//   A tiny tilemap primitive: it writes a pair of consecutive tile codes into two adjacent cells --
//   (HL) = A and (HL+1) = A+1 -- then steps the write pointer past the pair by the caller's stride and
//   bumps the tile code by two. It is the building block the 2x2 block-drawers call twice (top pair then
//   bottom pair): drawTileBlock2x2 (0x2585), drawBottomTilePairRestoreDe (0x258c), etc.
//
// ROLE IN THE MACHINE
//   Tiles are drawn by writing character codes into VRAM. Stamping a *pair* at a time lets a caller lay a
//   two-wide glyph (e.g. the left/right halves of a wide character) in one call, and returning the advanced
//   pointer/tile lets a loop chain pairs without recomputing them. The stride (DE) is how far past the
//   second cell the next pair begins -- a row step, or a small back-step for the upward-growing variant.
//
// LIVE-OUT
//   mem8[dst] = tile, mem8[dst+1] = tile+1; m.regs.a = (tile+2) mod 256, m.regs.hl = dst+1+stride. Also
//   returns { a, hl } for idiomatic callers. Register mirrors: A tile code, HL dst pointer, DE stride.
import { u16 } from "../../../core/int.js";

export function stampTilePair(m, tile = m.regs.a, dst = m.regs.hl, stride = m.regs.de) {
  const { mem8 } = m;

  // Stamp the pair: the first cell gets `tile`, the next cell gets `tile+1`. Both are byte stores, so the
  // second write truncates -- tile = 0xff writes 0xff then 0x00 (the +1 wraps).
  // stamp the pair (byte store truncates, so tile=0xff writes 0xff then 0x00)
  mem8[dst] = tile;
  const dstNext = u16(dst + 1);
  mem8[dstNext] = tile + 1;

  // Advance: the pointer moves past the second cell by the stride (dst+1+stride, wrapped to 16 bits) and
  // the tile code climbs by two so the next pair continues the sequence.
  // advance past the second cell by the stride, and the tile code by two
  const advancedDst = u16(dstNext + stride);
  const advancedTile = (tile + 2) & 0xff;

  // Publish the advanced state into the register mirror and hand it back for the idiomatic caller's loop.
  return (m.regs.a = advancedTile, m.regs.hl = advancedDst, { a: advancedTile, hl: advancedDst });
}
