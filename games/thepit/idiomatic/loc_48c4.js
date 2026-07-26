// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_48c4 — recolour a fixed nine-cell colour-RAM column, cycling its colour one
 * step each call.  ROM 0x48c4.
 *
 * Called from the dig / wall-collision core (loc_03e8) once its dig probe reads
 * clear, so it runs as a slow background recolour of one playfield column. Each call:
 *   - Sets the fill length to nine cells (the count the column-fill helper reads).
 *   - Advances the colour value one step while holding bit 3 permanently clear: the
 *     value walks the palette codes that never turn that bit on, wrapping around.
 *   - Aims at a fixed cell — column 6, row 10 — and derives that cell's colour- and
 *     video-RAM addresses (via the shared cell-address helpers).
 *   - Paints the advanced colour straight down the nine-cell column in colour RAM.
 * Unlike its sibling column routines it copies no tile graphics — it only recolours.
 *
 * Reached through a conditional call and left through the fill helper's own return,
 * so nothing downstream reads a value it leaves behind; its whole product is the
 * recoloured colour-RAM column.
 *
 * The three cell helpers (offset calc, address derive, column fill) are still the
 * frozen oracle, so they are driven the way they expect: they read their inputs
 * straight from the bytes seated above and return through the address pushed for
 * them here. The fill is entered as a tail hand-off — its own return unwinds all the
 * way back to loc_48c4's caller, so it is written as a JS return, not a loop.
 *
 * Memory-equivalent to the frozen oracle — equivalence-48c4.test.js.
 * GATE:     strict — real captured boot/attract dispatches (loc_03e8 fires it 26x in
 *           a 1200-frame run, first during boot); oracle vs this leave byte-identical
 *           RAM, register file, pc AND stack. Teeth: a dropped colour advance is
 *           caught at BOARD_MODE.
 * LIVE-OUT: memory-only — the recoloured colour-RAM column. (The still-oracle callees
 *           are driven through the real stack, so the register file, pc and stack come
 *           out identical too, and the gate compares all of them.)
 * NAMES:    BOARD_MODE (0x8057, cycled here as the column's colour code), TILE_COL
 *           (0x8058), TILE_ROW (0x8059) from ram.js. Hex-kept: 0x8055 (fill length,
 *           unnamed) and the two oracle-boundary return addresses 0x48df / 0x48e2.
 */

import { BOARD_MODE, TILE_COL, TILE_ROW } from "./ram.js";

export function loc_48c4(m) {
  const { mem } = m;

  // Nine cells tall — the length the column fill will paint.
  mem.write8(0x8055, 9);

  // Advance the colour one step, but never let bit 3 turn on: the value cycles
  // through the palette codes that keep that bit clear.
  const color = mem.read8(BOARD_MODE);
  mem.write8(BOARD_MODE, (color + 1) & 0xf7);

  // Aim at the fixed target cell: column 6, row 10.
  mem.write8(TILE_COL, 6);
  mem.write8(TILE_ROW, 10);

  // (column,row) -> tilemap offset, then -> that cell's colour + video addresses.
  m.push16(0x48df); m.call(0x3dae);
  m.push16(0x48e2); m.call(0x3dc9);

  // Paint the advanced colour down the nine-cell column; its return unwinds to
  // loc_48c4's caller.
  return m.call(0x3e01);
}
