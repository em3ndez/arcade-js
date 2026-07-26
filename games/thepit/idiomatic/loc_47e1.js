// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_47e1 — paint one fixed vertical panel (a tile column plus its matching colour
 * column) into the playfield at screen column 1, row 12. ROM 0x47e1.
 *
 * The panel is three stacked vertical runs down that one column, every run using the
 * same fill byte 7:
 *   1. its top cell is stamped with the current secondary game-state byte,
 *   2. the next seven cells come from a fixed tile table in ROM, and
 *   3. a nine-cell colour column is painted underneath so the whole strip shares a
 *      colour attribute.
 * It is invoked only while a game is actually running — the round-setup path calls it
 * only for the 1-and-2-player modes, and the in-play HUD refresh loops call it — so the
 * strip is very likely the started-game status/HUD readout. That semantic role is not
 * yet confirmed to the naming bar, so the routine keeps its address name.
 *
 * The work is done by five shared plot helpers (0x3dae/0x3dc9/0x3dea/0x3ddb/0x3e01),
 * which are still the frozen oracle. This routine only seeds their scratch parameter
 * block (target cell, fill byte, run length, source pointer) and drives them in order;
 * the last one is a tail hand-off that returns straight to this routine's own caller.
 *
 * Memory-equivalent to the frozen oracle — equivalence-47e1.test.js.
 * GATE:     crafted-entry — never reached in plain attract (the started-game HUD path),
 *           so a real captured attract state is given a clean call stack and run
 *           oracle-vs-idiomatic across a few secondary-state values. Teeth: a wrong
 *           fill byte and a corrupted output cell.
 * LIVE-OUT: memory-only — the painted tilemap / colour / video cells; no caller reads a
 *           returned register (the residual a=7, ix=0x49aa are dead ABI). The whole
 *           register file, sp and pc still match the oracle because every helper is the
 *           frozen oracle, driven through the same call linkage.
 * NAMES:    TILE_COL (0x8058), TILE_ROW (0x8059), GAME_STATE2 (0x8002) from ram.js.
 *           Hex-kept: the plotter scratch params below (ram.js names 0x8057 BOARD_MODE
 *           for a different entry-select role, so it is not imported here); the ROM tile
 *           table; and the helper return addresses (call linkage to the frozen helpers).
 */

import { TILE_COL, TILE_ROW, GAME_STATE2 } from "./ram.js";

// The shared tile-plotter's scratch parameter block (0x8055-0x8060). These are the
// plotter ABI the helpers below read, not game state, so they stay hex here.
const PLOT_RUN_LENGTH = 0x8055; // how many cells down the column the next run paints
const PLOT_FILL_BYTE = 0x8057; // the colour byte the colour-column paint writes

// A fixed run of tile codes in ROM used for the panel's seven middle cells.
const PANEL_TILE_TABLE = 0x49b1;

export function loc_47e1(m) {
  const { regs, mem } = m;

  // Aim the panel at tile column 1, row 12, then let the address helpers turn that
  // cell into the tilemap offset (0x805a) and the colour-/video-RAM cursors that the
  // paint helpers write through. Each helper is still the frozen oracle, so it is
  // reached through the address registry with its return address staged for it —
  // plain call linkage that dissolves once these helpers are decompiled too.
  mem.write8(TILE_COL, 1);
  mem.write8(TILE_ROW, 12);
  m.push16(0x47ee);
  m.call(0x3dae); // (row, col) -> tilemap offset
  m.push16(0x47f1);
  m.call(0x3dc9); // tilemap offset -> colour-RAM + video-RAM write cursors

  // Every run of the panel is painted with fill byte 7.
  mem.write8(PLOT_FILL_BYTE, 7);

  // Top cell: stamp the current secondary game-state byte as the panel's first tile
  // (the helper copies one byte down the column from the source pointer).
  mem.write8(PLOT_RUN_LENGTH, 1);
  regs.ix = GAME_STATE2; // source: the byte at GAME_STATE2
  m.push16(0x4802);
  m.call(0x3dea);

  // Next seven cells: a fixed tile run out of the ROM table (its first cell takes the
  // helper's own cap byte, the remaining cells walk the table backwards).
  mem.write8(PLOT_RUN_LENGTH, 7);
  regs.ix = PANEL_TILE_TABLE;
  m.push16(0x480e);
  m.call(0x3ddb);

  // Finally paint a nine-cell colour column with the fill byte, so the strip shares one
  // colour. This is a tail hand-off: the colour-paint helper returns to our own caller.
  mem.write8(PLOT_RUN_LENGTH, 9);
  return m.call(0x3e01);
}
