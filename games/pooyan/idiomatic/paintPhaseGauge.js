// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintPhaseGauge — draw the phase counter as a five-cell vertical HUD gauge.
 *
 * Reads GAUGE_PHASE_COUNTER: a zero count leaves the gauge untouched; otherwise (count - 1)
 * cells, clamped to five, are drawn with the filled tile from the base cell upward (one
 * tilemap row per cell), and the remaining cells above them are drawn with the blank tile.
 * Calls nothing.
 *
 * LIVE-OUT: memory only (up to five gauge tiles); no register or flag survives for a caller.
 */
import { u16 } from "../../../core/int.js";
import { GAUGE_PHASE_COUNTER, PHASE_GAUGE_BASE_TILE } from "./names.js";

const GAUGE_CELLS = 0x05; //   the gauge is five cells tall
const ROW_UP = -0x20; //       each cell sits one tilemap row above the last
const TILE_FILLED = 0xb0;
const TILE_BLANK = 0x10;

export function paintPhaseGauge(m) {
  const { mem8 } = m;

  const count = mem8[GAUGE_PHASE_COUNTER];
  if (count === 0) return; // zero count leaves the gauge as-is

  let filled = count - 1;
  if (filled > GAUGE_CELLS) filled = GAUGE_CELLS; // clamp to the five cells

  let cell = PHASE_GAUGE_BASE_TILE;
  for (let i = 0; i < filled; i++) {
    mem8[cell] = TILE_FILLED;
    cell = u16(cell + ROW_UP);
  }
  for (let i = filled; i < GAUGE_CELLS; i++) {
    mem8[cell] = TILE_BLANK;
    cell = u16(cell + ROW_UP);
  }
}
