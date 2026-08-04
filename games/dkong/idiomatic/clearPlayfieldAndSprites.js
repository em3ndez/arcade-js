// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearPlayfieldAndSprites — blank the tilemap playfield and zero the sprite
 * shadow buffer for board / power-on setup.  ROM 0x0874.
 *
 * Takes no inputs and calls nothing — a straight-line, constant memory transform
 * (every operand is an immediate; it reads no register and no RAM). It is invoked
 * by every board / game-state SETUP handler (loc_08ba, loc_08f8, loc_0bda,
 * loc_141e, loc_0c92, loc_0a63, loc_07c3, handler_0779, handler_01c3) to wipe the
 * screen before the new scene is drawn. Three fixed fills, then return:
 *
 *   1. PLAYFIELD. Writes the blank tile 0x10 across the central 28 columns of all
 *      32 rows of the video-RAM tilemap, from VRAM 0x7404. The tilemap is 32 cells
 *      wide but the playfield is the middle 28, so each row advances by a 0x20
 *      stride (28 written + 4 skipped). 896 cells.
 *   2. SIDE COLUMNS. Writes the blank tile 0x10 down two 14-cell vertical columns
 *      at VRAM 0x7522 and 0x7523, stepping one whole tilemap row (0x20) per cell.
 *   3. SPRITE BUFFER. Zeroes the 384-byte sprite shadow buffer SPRITE_BUFFER
 *      (0x6900-0x6A7F) = 96 hardware sprite records x 4 bytes — the i8257
 *      channel-0 DMA source blitted to sprite RAM 0x7000 each vblank. The oracle
 *      does it as two djnz runs (256 + 128, `ld b,0` == 256); one span here.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0874.test.js.
 * GATE:     crafted-entry; reached in attract via the setup handlers (real
 *           dispatches) + crafted entries with the three target regions pre-poked
 *           to a sentinel on BOTH sides, which pins the exact write footprint
 *           against the oracle (the routine reads nothing, so one such pair proves
 *           equivalence for every start state). Teeth = a one-column-short fill.
 * LIVE-OUT: memory-only — the tilemap + sprite-buffer bytes. No live registers or
 *           flags: every one of the nine callers overwrites A/flags (`xor a`) or
 *           does a flag-neutral load (`ld hl,..` / `ld a,..`) or an unconditional
 *           `call` before reading anything, so the oracle's terminal A/BC/DE/HL/F
 *           are dead ABI. SP/PC are not compared — the idiomatic layer drops the
 *           `ret`'s stack/PC bookkeeping (the JS call stack replaces it).
 * NAMES:    SPRITE_BUFFER (0x6900). The VRAM tilemap bases (0x7404 playfield,
 *           0x7522/0x7523 side columns) stay hex — video RAM, not named in names.js.
 */

import { SPRITE_BUFFER } from "./names.js";

const PLAYFIELD_TOP = 0x7404; // VRAM tilemap: first playfield cell
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

  // 3. Sprite buffer: zero the 384-byte shadow buffer (DMA source for 0x7000).
  for (let i = 0; i < SPRITE_BUFFER_BYTES; i++) {
    mem.write8((SPRITE_BUFFER + i) & 0xffff, 0x00);
  }
}
