// SPDX-License-Identifier: GPL-3.0-only
import { COUNT_COLUMN_VRAM, GAME_ACTIVE_FLAG, ACTOR_TABLE } from "./names.js";
/**
 * loc_039b — paint the count column: fill its top cells, blank the rest.
 *
 * When the game-active gate is clear it paints nothing. Otherwise the fill height is the
 * actor-table count plus one, clamped to the eight-cell column: it writes that many fill
 * tiles down the column one row apart, then blanks the remaining cells. A zero fill height
 * runs the full 256-cell wrap (a hardware down-counter), matching the original.
 *
 * LIVE-OUT: memory only — the tile cells of the column.
 */

const TILE_FILL = 0x0c; // filled portion of the column
const TILE_BLANK = 0x10; // blank / erase tile
const COLUMN_HEIGHT = 0x08; // total cells in the column
const ROW_STRIDE = 0x20; // one tilemap row down

export function loc_039b(m) {
  const { mem8 } = m;

  if (mem8[GAME_ACTIVE_FLAG] === 0) return; // gate clear -> paint nothing

  let filled = (mem8[ACTOR_TABLE] + 1) & 0xff; // count + 1 (8-bit wrap)
  if (filled >= COLUMN_HEIGHT) filled = COLUMN_HEIGHT; // clamp to the column height

  let cell = COUNT_COLUMN_VRAM;
  let fill = filled; // down-counter: 0 runs a full 256-cell pass, as on hardware
  do {
    mem8[cell] = TILE_FILL;
    cell = cell + ROW_STRIDE;
    fill = (fill - 1) & 0xff;
  } while (fill !== 0);

  let blank = (COLUMN_HEIGHT - filled) & 0xff; // remaining cells to erase
  if (blank === 0) return; // column full -> nothing left to blank

  do {
    mem8[cell] = TILE_BLANK;
    cell = cell + ROW_STRIDE;
    blank = (blank - 1) & 0xff;
  } while (blank !== 0);
}
