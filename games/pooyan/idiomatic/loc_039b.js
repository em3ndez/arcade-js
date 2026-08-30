// SPDX-License-Identifier: GPL-3.0-only
import { COUNT_COLUMN_VRAM, GAME_ACTIVE_FLAG, ACTOR_TABLE } from "./names.js";
/**
 * loc_039b — paint the on-screen count column: fill its top cells, blank the rest.
 * ROM 0x039b. Grounding: [seen].
 *
 * WHAT IT IS: a small HUD painter. One eight-cell column of the tilemap (at COUNT_COLUMN_VRAM,
 * 0x8482) shows a running count as a stack of tiles — the more there are, the more filled cells
 * appear, the rest of the column blank. This routine repaints that whole column from the current
 * count each time it runs.
 *
 * THE COUNT: the fill height is the actor-table count byte (ACTOR_TABLE, 0x8a80) plus one, so a
 * count of zero still shows one filled cell. That total is clamped to COLUMN_HEIGHT (8) — the
 * column can never overflow its eight cells. The remaining cells (8 minus the fill height) are
 * painted with the blank tile, erasing whatever taller stack was there before.
 *
 * THE COLUMN LAYOUT: cells one above another in the tilemap are ROW_STRIDE (0x20 = 32) bytes
 * apart, one full tilemap row; the routine walks down the column by adding that stride. It
 * writes TILE_FILL (0x0c) for the filled portion and TILE_BLANK (0x10) for the erased portion.
 *
 * THE GATE: nothing is painted unless the game-active flag (GAME_ACTIVE_FLAG, 0x8806) is set —
 * the HUD is only maintained while a game is in progress.
 *
 * LIVE-OUT: memory only — the repainted tile cells of the column.
 */

const TILE_FILL = 0x0c; // filled portion of the column
const TILE_BLANK = 0x10; // blank / erase tile
const COLUMN_HEIGHT = 0x08; // total cells in the column
const ROW_STRIDE = 0x20; // one tilemap row down

export function loc_039b(m) {
  const { mem8 } = m;

  // Only maintain the HUD while a game is running: a clear game-active flag paints nothing.
  if (mem8[GAME_ACTIVE_FLAG] === 0) return; // gate clear -> paint nothing

  // Fill height = actor count + 1 (so zero still shows one cell), taken 8-bit as on hardware.
  let filled = (mem8[ACTOR_TABLE] + 1) & 0xff; // count + 1 (8-bit wrap)
  // Clamp to the column height: the column can hold at most eight filled cells.
  if (filled >= COLUMN_HEIGHT) filled = COLUMN_HEIGHT; // clamp to the column height

  // Walk down the column writing the fill tile. The counter is decremented and tested AFTER
  // each write (a hardware down-counter): a fill height of 0 would run a full 256-cell pass,
  // never zero — but the +1 above means it is at least 1 here.
  let cell = COUNT_COLUMN_VRAM;
  let fill = filled; // down-counter: 0 runs a full 256-cell pass, as on hardware
  do {
    mem8[cell] = TILE_FILL;
    cell = cell + ROW_STRIDE; // step down one tilemap row
    fill = (fill - 1) & 0xff;
  } while (fill !== 0);

  // Cells left to erase = column height minus the filled portion.
  let blank = (COLUMN_HEIGHT - filled) & 0xff; // remaining cells to erase
  if (blank === 0) return; // column full -> nothing left to blank

  // Continue down from where the fill stopped, writing the blank tile over the remainder to
  // erase any taller stack painted on a previous frame.
  do {
    mem8[cell] = TILE_BLANK;
    cell = cell + ROW_STRIDE; // step down one tilemap row
    blank = (blank - 1) & 0xff;
  } while (blank !== 0);
}
