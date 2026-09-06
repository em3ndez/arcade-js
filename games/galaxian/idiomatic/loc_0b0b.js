// SPDX-License-Identifier: GPL-3.0-only
// Player-shot vs formation collision. While the shot gate is armed, band the shot's Y into a row and
// its X-delta into a column, index the formation flag grid, and if that cell holds a live alien clear
// it, stamp a hit record (flag, phase 0, shot position) and enqueue two command words for the hit.
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import {
  loc_4208, loc_4209, loc_420a, loc_420b, loc_420e,
  loc_42b1, loc_42b2, loc_42b3, FLAG_BITS_BASE,
} from "./names.js";

const GATE_BIT = 0x01;      // shot-armed gate, bit0
const CELL_OCCUPIED = 0x01; // grid-cell bit0: alien present

// Rotate an 8-bit value right four bits (nibble swap).
const rotr4 = (v) => ((v >> 4) | (v << 4)) & 0xff;

export function loc_0b0b(m) {
  const { mem8, mem16 } = m;

  // The shot must be armed.
  if ((mem8[loc_4208] & GATE_BIT) === 0) return;

  // Reject shots outside the formation's vertical span.
  const pos = mem8[loc_4209];
  if (pos >= 104) return;
  let y = pos - 30;
  if (y < 0) return;

  // Band Y into a row index: each row is one 7-then-5 step down from the top.
  let row = 6;
  for (;;) {
    y -= 7;
    if (y < 0) return;     // fell into the gap between rows
    y -= 5;
    if (y < 0) break;      // settled on this row
    row -= 1;
    if (row === 0) return; // below the last row
  }

  // Column offset of the shot vs the formation anchor; reject outside the hit window.
  const dx = (mem8[loc_420a] - mem8[loc_420e]) & 0xff;
  if ((((dx & 0x0f) - 2) & 0xff) >= 11) return;

  // Locate the grid cell; bail unless it holds a live alien, else clear it.
  const index = rotr4(((dx & 0xf0) + (row + 1)) & 0xff);
  const cell = FLAG_BITS_BASE + index;
  if ((mem8[cell] & CELL_OCCUPIED) === 0) return;
  mem8[cell] = 0;

  // First command word: kind 1 with the grid index.
  enqueueCommandWord(m, (1 << 8) | index, cell);

  // Stamp the hit record: active flag, phase 0, and the shot's position word.
  mem8[loc_420b] = 1;
  mem8[loc_42b1] = 1;
  mem8[loc_42b2] = 0;
  mem16[loc_42b3] = mem16[loc_4209];

  // Second command word: kind 3 with a column code derived from the grid index.
  const code = index < 80 ? 0 : (rotr4(index & 0x70) - 4) & 0xff;
  return enqueueCommandWord(m, (3 << 8) | code, cell);
}
