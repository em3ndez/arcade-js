// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_4816 — paint one fixed vertical tile strip of the round's static playfield,
 * then its matching colour column.  ROM 0x4816.
 *
 * Round setup (loc_02e1 / loc_02ca) draws the static playfield by calling a run of
 * these strip painters. This one positions a tile-cell cursor at column 1, row 11,
 * resolves that cell's tilemap and colour addresses, then lays a 10-cell vertical
 * run down the column:
 *
 *   - The strip's top cell takes a fixed cap byte and the nine cells below it are
 *     walked backwards through a ROM tile table at 0x494f (the tilemap fill).
 *   - The colour column then paints the same 10 cells with a single colour value (0).
 *
 * The cursor placement, address resolve, tilemap fill and colour-column fill are all
 * still the frozen oracle, so they are called across the oracle boundary. Two things
 * follow from that. First, the three returning calls keep the Z80 return-address push
 * beside them: those callees pop it on the way out, and this hardware's stack lives in
 * work RAM that the gate compares, so the pushed/popped bytes must land exactly where
 * the oracle leaves them. Second, the colour-column fill is a tail call — its own
 * return pops loc_4816's caller, so this routine returns whatever it returns and has no
 * return of its own. The only value handed across the boundary in a register is the
 * ROM source-table pointer the tilemap fill walks; every cursor, count and fill byte
 * is written straight to memory.
 *
 * NAME kept loc_4816: the mechanism (paint a fixed tile strip + colour column) is
 * clear, but this is one of a ~9-routine family (loc_472c..loc_48e5) that each paint a
 * different fixed strip, and which playfield element this particular one is has not
 * been earned — an English name would over-claim one strip's identity.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4816.test.js.
 * GATE:     crafted-entry. loc_4816 is round-setup, NOT reached in attract, so it is
 *           validated on real machine states captured at a shared callee's dispatch
 *           (loc_3dae) during a boot/attract run: oracle and this run identically on
 *           clones, diffed on full RAM + registers + pc. Teeth = a wrong strip height.
 * LIVE-OUT: memory-only — the painted tilemap strip + colour column and the paint
 *           scratch (cursor 0x8058/0x8059, offset/address words 0x805a/0x805e/0x8060,
 *           count 0x8055, fill byte 0x8057). The caller reloads its own register from
 *           RAM and consumes nothing this leaves; the residual registers are the tail
 *           callee's and are reproduced for free by making the identical calls.
 * NAMES:    TILE_COL (0x8058), TILE_ROW (0x8059) from ram.js. Kept hex: 0x8057 is the
 *           colour fill byte here — ram.js reads this scratch as BOARD_MODE for a
 *           different routine family, so naming it that here would mislead; 0x8055 is
 *           the strip cell count (unnamed); 0x494f is a ROM tile-table address.
 */

import { TILE_COL, TILE_ROW } from "./ram.js";

// ROM tile table the tilemap fill walks (backwards) for every cell below the cap.
const STRIP_SOURCE_TABLE = 0x494f;
// Paint scratch shared with the fill helpers: the colour value painted down the
// column, and the number of cells in the vertical run.
const COLOUR_FILL = 0x8057;
const STRIP_HEIGHT = 0x8055;

export function loc_4816(m) {
  const { regs, mem } = m;

  // Position the tile-cell cursor at column 1, row 11, and resolve that cell's
  // tilemap offset then its colour/video-RAM addresses. The pushed word beside each
  // call is the return address the callee pops (the stack is compared memory).
  mem.write8(TILE_COL, 1);
  mem.write8(TILE_ROW, 11);
  m.push16(0x4823);
  m.call(0x3dae); // cursor -> tilemap offset word (0x805a)
  m.push16(0x4826);
  m.call(0x3dc9); // offset -> colour + video addresses (0x805e / 0x8060)

  // Colour value 0, a 10-cell run, source table pointer, then paint the tilemap strip
  // (top cell = the fixed cap, the nine below walked back through the ROM table).
  mem.write8(COLOUR_FILL, 0);
  mem.write8(STRIP_HEIGHT, 10);
  regs.ix = STRIP_SOURCE_TABLE; // the tilemap fill's one register live-in
  m.push16(0x4837);
  m.call(0x3ddb); // fill the 10-cell tilemap strip

  // Tail into the colour-column fill: it paints the matching 10-cell colour run and
  // its own return carries loc_4816's caller, so this routine has no return of its own.
  return m.call(0x3e01);
}
