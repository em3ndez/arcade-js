// SPDX-License-Identifier: GPL-3.0-only
/**
 * stamp75mBoardTiles — during elevator-board setup, stamp two fixed two-row tile motifs into
 * the background tilemap.
 *
 * Part of the static background of the elevator board, planted before its layout table is
 * chosen. It takes no input at all: it calls the shared two-row filler twice at two hard-coded
 * tilemap positions, each laying 17 cells of one tile code along a row and 17 cells of a
 * second code on the row directly below. The second motif sits eight tilemap rows above the
 * first, and the two 34-byte motifs are disjoint — 68 background cells in all.
 *
 * Every value and destination is a baked constant, so the routine reads no memory and no
 * register and repaints identically on every call. Unlike the tile stamps for the other boards
 * it carries no internal board check, because it is only ever reached from the elevator-board
 * setup arm.
 *
 * The filler reads its top-left write cell from a pointer register, so that register is loaded
 * before each of the two calls. It is scratch handed to the filler, not an input to this
 * routine.
 *
 * NOT A SPRITE CLEAR: the writes land in the background tilemap, not the sprite buffer, and
 * they set tile codes rather than blanking anything.
 *
 * Reads: nothing. Writes: the 68 background tilemap cells of the two motifs.
 *
 * LIVE-OUT: memory-only.
 */

import { fillTileRowPair } from "./fillTileRowPair.js";

export function stamp75mBoardTiles(m) {
  const { regs } = m;

  // First motif: the 17 + 17 two-row pair (the filler reads its top-left cell from here).
  regs.hl = 0x770d;
  fillTileRowPair(m);

  // Second motif: the same pair eight tilemap rows higher.
  regs.hl = 0x760d;
  fillTileRowPair(m);
}
