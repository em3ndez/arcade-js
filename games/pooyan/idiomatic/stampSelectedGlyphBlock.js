// SPDX-License-Identifier: GPL-3.0-only
import { blitTile3x3Block } from "./blitTile3x3Block.js";
import { GLYPH_TILES_A, GLYPH_TILES_B, GLYPH_BLOCK_DEST } from "./names.js";
/**
 * stampSelectedGlyphBlock — paint one of two fixed 3x3 glyph blocks into the tilemap.
 *
 * WHAT IT IS
 *   A tiny selector-then-stamp leaf in the glyph-HUD / round-label family. It picks which
 *   of two hard-wired 3x3 glyph pictures to draw, points at a fixed screen cell, and hands
 *   the job to the shared 3x3 block stamper. It carries no loop or state of its own — the
 *   only decision it makes is "which of the two glyphs?".
 *
 * ROLE IN THE MACHINE
 *   The round/label render code stamps small pictorial glyph blocks (the round-marker
 *   symbols) as part of building the status area. Those blocks come in variants, and the
 *   variant is encoded as a single bit in the selector register the caller passes in. This
 *   routine is the one-bit fork: it maps that selector bit onto one of the two ROM glyph
 *   tables and blits it, so callers can request "glyph A" or "glyph B" without knowing the
 *   table addresses.
 *
 * ROM ADDRESS
 *   0x1ffb-0x200c.
 *
 * GROUNDING
 *   [seen].
 *
 * THE SELECTOR BIT
 *   The selector is the B register (SELECT_BIT = 0x20, i.e. bit 5). Bit 5 clear picks the
 *   first glyph table (GLYPH_TILES_A, ROM 0x203b); bit 5 set picks the second
 *   (GLYPH_TILES_B, ROM 0x2050). Each table is a nine-byte block: three tile codes per row,
 *   three rows, laid out to match the 3x3 stamp the block helper performs.
 *
 * THE DESTINATION
 *   The block always lands at GLYPH_BLOCK_DEST (0x8062), the top-left cell of a fixed 3x3
 *   square on the 0x8000-page colour/attribute tilemap region (0x8000-0x83ff). Cells one
 *   screen row apart are 0x20 apart, so the nine tiles occupy 0x8062/0x8063/0x8064, then
 *   0x8082.. and 0x80a2.. one row down each.
 *
 * LIVE-OUT
 *   Memory only — the nine stamped tiles at GLYPH_BLOCK_DEST. The block stamper advances its
 *   own destination and source pointers as a chaining convenience for callers that stamp a
 *   run of blocks, but this routine chains nothing after the stamp, so neither advanced
 *   pointer survives as game state here.
 */
const SELECT_BIT = 0x20;

export function stampSelectedGlyphBlock(m, selector = m.regs.b) {
  // Step 1 — choose the glyph table from bit 5 of the selector (ROM 0x1ffc-0x2008).
  // The machine copies B into A, tests bit 5, and defaults the source table to
  // GLYPH_TILES_A (0x203b); only when bit 5 is set does it swap in GLYPH_TILES_B (0x2050).
  // Same fork here: bit set -> table B, bit clear -> table A. This is purely which nine-byte
  // ROM glyph the following stamp reads from.
  const table = (selector & SELECT_BIT) !== 0 ? GLYPH_TILES_B : GLYPH_TILES_A;
  // Step 2 — stamp the chosen glyph into the fixed screen square (ROM 0x2009 loads the
  // destination 0x8062, then the 3x3 block stamp runs and this returns after it). The block
  // helper copies the nine tile codes from the selected table into the 3x3 cells based at
  // GLYPH_BLOCK_DEST (0x8062), stepping +0x20 down one screen row after each three writes.
  return blitTile3x3Block(m, GLYPH_BLOCK_DEST, table);
}
