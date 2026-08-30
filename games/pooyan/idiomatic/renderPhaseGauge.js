// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderPhaseGauge — paint the phase counter as a five-cell vertical bar on the HUD.
 *
 * ROM 0x03c2-0x03e8. Grounding: [seen].
 *
 * A Pooyan stage is divided into a small number of "phases". GAUGE_PHASE_COUNTER (work RAM
 * 0x8908) holds how many are left: it starts each stage at 3, drains one per phase down through
 * 2, 1, 0, and reaching 0 triggers the phase-exhausted transition (which clears the rope).
 * This routine is the HUD readout of that counter — a vertical bar, five tile cells tall,
 * drawn straight into the tilemap.
 *
 * The bar lives in the character/tilemap RAM. PHASE_GAUGE_BASE_TILE (0x863f) is the BOTTOM
 * cell; each cell above it sits one tilemap row higher, and one row is 0x20 (32) tile columns,
 * so the address of the next cell up is the current cell minus 0x20. Two tile codes make up
 * the bar: 0xb0 is the "filled" segment glyph and 0x10 is the blank/background glyph.
 *
 * How many cells fill: the counter value minus one, capped at the five available cells. So a
 * counter of 3 fills two cells and blanks three; a full counter fills the whole bar. A counter
 * of 0 is the special "nothing to show" case — the routine leaves whatever is already on screen
 * untouched rather than blanking the bar.
 *
 * LIVE-OUT: memory only (up to five gauge tiles in tilemap RAM from 0x863f upward); no register
 * or flag survives for a caller. Calls nothing.
 */
import { u16 } from "../../../core/int.js";
import { GAUGE_PHASE_COUNTER, PHASE_GAUGE_BASE_TILE } from "./names.js";

const GAUGE_CELLS = 0x05; //   the gauge is five cells tall
const ROW_UP = -0x20; //       each cell sits one tilemap row above the last
const TILE_FILLED = 0xb0; //   the "filled segment" glyph
const TILE_BLANK = 0x10; //    the blank/background glyph

export function renderPhaseGauge(m) {
  const { mem8 } = m;

  // Read the phases-remaining counter (0x8908). A zero value is the "leave the bar alone"
  // case: the ROM returns immediately without writing any tile, so a stale on-screen bar
  // stays put until the next non-zero draw.
  const count = mem8[GAUGE_PHASE_COUNTER];
  if (count === 0) return; // zero count leaves the gauge as-is

  // The number of filled cells is one fewer than the counter value, and the bar is only five
  // cells tall, so clamp anything above five back down to five.
  let filled = count - 1;
  if (filled > GAUGE_CELLS) filled = GAUGE_CELLS; // clamp to the five cells

  // Draw the filled segments from the bottom cell (0x863f) upward, stepping one tilemap row
  // (0x20 columns) up per cell. The u16 wrap keeps the address inside the 16-bit tilemap space.
  let cell = PHASE_GAUGE_BASE_TILE;
  for (let i = 0; i < filled; i++) {
    mem8[cell] = TILE_FILLED;
    cell = u16(cell + ROW_UP);
  }

  // Blank the remaining cells above the filled ones, continuing upward with the same -0x20
  // stride, so the top of the bar always shows background up to the five-cell height.
  for (let i = filled; i < GAUGE_CELLS; i++) {
    mem8[cell] = TILE_BLANK;
    cell = u16(cell + ROW_UP);
  }
}
