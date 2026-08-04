// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearPlayfieldAndSprites — blank the tilemap playfield and zero the sprite shadow buffer, so a
 * board or power-on setup starts from an empty screen.
 *
 * Takes no inputs and calls nothing: every value it writes is a constant, so the same three fills
 * happen on every invocation regardless of game state.
 *
 *   1. PLAYFIELD. Writes the blank tile across the central 28 columns of all 32 tilemap rows —
 *      896 cells. The tilemap is 32 cells wide and the playfield is the middle 28, so each row
 *      advances by a whole-row stride (28 written, 4 skipped).
 *   2. SIDE COLUMNS. Writes the blank tile down two 14-cell vertical runs beside the playfield,
 *      stepping one whole tilemap row per cell.
 *   3. SPRITE BUFFER. Zeroes all 384 bytes of the sprite shadow buffer — 96 hardware sprite
 *      records of 4 bytes each — which is the block the sprite hardware is fed from each vblank,
 *      so zeroing it takes every sprite off the screen.
 *
 * LIVE-OUT: memory-only — the tilemap cells and the sprite-buffer bytes.
 */

import { SPRITE_BUFFER } from "./names.js";

const PLAYFIELD_TOP = 0x7404; // first playfield cell of the video-RAM tilemap
const PLAYFIELD_ROWS = 32;
const PLAYFIELD_COLS = 28; // central columns; the tilemap is ROW_STRIDE (32) wide
const ROW_STRIDE = 0x20; // one whole tilemap row
const BLANK_TILE = 0x10;

const SIDE_COL_BASES = [0x7522, 0x7523]; // two side columns, filled in this order
const SIDE_COL_CELLS = 0x0e; // 14 cells each, one whole row apart

const SPRITE_BUFFER_BYTES = 0x180; // 384 = 96 sprite records x 4

export function clearPlayfieldAndSprites(m) {
  const { mem } = m;

  // 1. Playfield: blank the central 28 columns of every tilemap row, skipping the
  //    4 off-playfield cells at each row's end (28 written + 4 skipped = 0x20).
  let cell = PLAYFIELD_TOP;
  for (let row = 0; row < PLAYFIELD_ROWS; row++) {
    for (let col = 0; col < PLAYFIELD_COLS; col++) {
      mem.write8(cell, BLANK_TILE);
      cell = (cell + 1) & 0xffff;
    }
    cell = (cell + (ROW_STRIDE - PLAYFIELD_COLS)) & 0xffff;
  }

  // 2. Side columns: two vertical 14-cell runs, one tilemap row apart per cell.
  for (const base of SIDE_COL_BASES) {
    let colCell = base;
    for (let i = 0; i < SIDE_COL_CELLS; i++) {
      mem.write8(colCell, BLANK_TILE);
      colCell = (colCell + ROW_STRIDE) & 0xffff;
    }
  }

  // 3. Sprite buffer: zero the 384-byte shadow buffer the sprite hardware reads each vblank.
  for (let i = 0; i < SPRITE_BUFFER_BYTES; i++) {
    mem.write8((SPRITE_BUFFER + i) & 0xffff, 0x00);
  }
}
