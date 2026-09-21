// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearPlayfieldAndSprites — blank the tilemap playfield and zero the sprite shadow buffer:
 * the central 28 columns of all 32 tilemap rows, two 14-cell side columns, then the 384-byte
 * sprite buffer. Every value written is a constant.
 *
 * LIVE-OUT: memory-only — the tilemap cells and the sprite-buffer bytes.
 */

import { u16 } from "../../../core/int.js";
import {
  PLAYFIELD_TOP,
  SPRITE_BUFFER,
  PLAYFIELD_SIDE_COL_BASE,
  PLAYFIELD_SIDE_BLANK_COL_B,
} from "./names.js";

const PLAYFIELD_ROWS = 32;
const PLAYFIELD_COLS = 28;
const ROW_STRIDE = 0x20;
const BLANK_TILE = 0x10;

const SIDE_COL_BASES = [PLAYFIELD_SIDE_COL_BASE, PLAYFIELD_SIDE_BLANK_COL_B];
const SIDE_COL_CELLS = 0x0e;

const SPRITE_BUFFER_BYTES = 0x180;

export function clearPlayfieldAndSprites(m) {
  const { mem8 } = m;

  let cell = PLAYFIELD_TOP;
  for (let row = 0; row < PLAYFIELD_ROWS; row++) {
    for (let col = 0; col < PLAYFIELD_COLS; col++) {
      mem8[cell] = BLANK_TILE;
      cell = u16(cell + 1);
    }
    cell = u16(cell + (ROW_STRIDE - PLAYFIELD_COLS));
  }

  for (const base of SIDE_COL_BASES) {
    let colCell = base;
    for (let i = 0; i < SIDE_COL_CELLS; i++) {
      mem8[colCell] = BLANK_TILE;
      colCell = u16(colCell + ROW_STRIDE);
    }
  }

  for (let i = 0; i < SPRITE_BUFFER_BYTES; i++) {
    mem8[u16(SPRITE_BUFFER + i)] = 0x00;
  }
}
