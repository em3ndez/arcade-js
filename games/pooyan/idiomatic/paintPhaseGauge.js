// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintPhaseGauge — draw the phase counter as a five-cell vertical HUD gauge.
 *
 * ROM 0x2065. Grounding: [seen].
 *
 * Pooyan runs each stage as a short series of phases; GAUGE_PHASE_COUNTER (0x8908) holds how
 * many phases remain and is drained one per phase, and when it hits zero the phase-exhausted
 * path fires (clearing the rope). This routine is that counter's on-screen readout: a vertical
 * bar of five tilemap cells in the HUD that fills from the bottom up as phases are used.
 *
 * The gauge is drawn from a fixed bottom cell, PHASE_GAUGE_BASE_TILE (0x863f), climbing one
 * tilemap row per cell. As in the other column painters, "up one row" is a fixed -0x20 step,
 * because rows are 0x20 (32) bytes apart in the tilemap and grow downward in address.
 *
 * How many cells read as filled: the raw counter minus one, clamped to the five-cell height.
 * So a counter of 1 shows an empty gauge (zero filled), a counter of 6 or more shows it full.
 * Filled cells get tile 0xb0; the cells above them, up to five total, get the blank tile 0x10.
 * A counter of exactly zero is a special case — the ROM returns immediately and leaves whatever
 * is on screen untouched rather than blanking the whole gauge.
 *
 * LIVE-OUT: memory only — up to five gauge tiles at 0x863f and the four cells above it. No
 * register or flag is left for a caller. Calls nothing.
 */
import { u16 } from "../../../core/int.js";
import { GAUGE_PHASE_COUNTER, PHASE_GAUGE_BASE_TILE } from "./names.js";

const GAUGE_CELLS = 0x05; //   the gauge is five cells tall
const ROW_UP = -0x20; //       each cell sits one tilemap row above the last (rows 0x20 apart)
const TILE_FILLED = 0xb0; //   tile drawn for a used-up (filled) phase cell
const TILE_BLANK = 0x10; //    tile drawn for a remaining (empty) phase cell

export function paintPhaseGauge(m) {
  const { mem8 } = m;

  // Read the phases-remaining counter. Zero is the untouched case: the ROM bails before
  // writing any cell, so a zero count leaves the existing gauge graphic in place.
  const count = mem8[GAUGE_PHASE_COUNTER];
  if (count === 0) return; // zero count leaves the gauge as-is

  // The number of filled cells is (count - 1), capped at the five-cell height. Counter 1 ->
  // 0 filled (empty gauge); counter 6+ -> all five filled.
  let filled = count - 1;
  if (filled > GAUGE_CELLS) filled = GAUGE_CELLS; // clamp to the five cells

  // Start at the fixed bottom cell of the HUD gauge and climb upward. Draw the filled cells
  // first, one tilemap row higher each pass.
  let cell = PHASE_GAUGE_BASE_TILE;
  for (let i = 0; i < filled; i++) {
    mem8[cell] = TILE_FILLED;
    cell = u16(cell + ROW_UP);
  }

  // Continue up through the rest of the five cells, drawing the blank tile so the top of the
  // gauge reads as unused phases.
  for (let i = filled; i < GAUGE_CELLS; i++) {
    mem8[cell] = TILE_BLANK;
    cell = u16(cell + ROW_UP);
  }
}
