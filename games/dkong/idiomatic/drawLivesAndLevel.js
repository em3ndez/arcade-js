// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawLivesAndLevel — redraw the reserve-lives indicator and the level-number digits.
 *
 * The top-of-screen HUD shows how many spare Marios are left (a vertical column of marker tiles)
 * and the current level number. This routine repaints both.
 *
 * In order:
 *   1. A guard skips the whole body during attract — the HUD is only maintained while a credited
 *      game is in progress.
 *   2. Blank all six marker slots to the empty tile, stepping one tilemap row UP from the bottom
 *      slot.
 *   3. Fill one marker tile per RESERVE life — LIVES minus the caller's count — from the bottom
 *      up. The caller's count is "lives currently in play" (the active Mario, so in practice 1,
 *      giving LIVES-1 reserve markers). When LIVES equals it, the count is zero and no marker is
 *      drawn.
 *   4. Stamp two fixed furniture tiles beside the indicator.
 *   5. Clamp the level number to 99, writing the clamp back only when it exceeds, then split it
 *      into two decimal digits by repeated subtraction of ten (there is no decimal-adjust step
 *      here) and write tens and units into two adjacent tilemap columns.
 *
 * The marker fill count is 8-bit, so a caller passing a count ABOVE LIVES would wrap to a large
 * number and paint far past the six slots. That is faithful to the hardware; in real play the
 * count is always 1 and LIVES is 1..6.
 *
 * LIVE-OUT: memory-only — every continuation overwrites the accumulator before reading it, and
 * none reads a flag this leaves behind.
 */

import { LIVES, LEVEL } from "./names.js";
import { gameActiveGuard } from "./gameActiveGuard.js";

// Reserve-lives marker column: six cells stepping one tilemap row UP from the bottom cell.
// Reserve markers fill from the bottom; unused slots hold the blank tile.
const MARKER_BOTTOM = 0x7783;
const MARKER_ROW_STEP = 0x20;
const MARKER_SLOTS = 6;
const TILE_BLANK = 0x10;
const TILE_MARKER = 0xff;

// Two fixed furniture tiles repainted beside the indicator each refresh.
const FURNITURE = [
  [0x7503, 0x1c],
  [0x74e3, 0x34],
];

// Level-number digit cells (adjacent tilemap columns, one row apart) and the clamp.
const LEVEL_UNITS_CELL = 0x74a3;
const LEVEL_TENS_CELL = 0x74c3;
const LEVEL_MAX = 0x63; // 99 decimal

export function drawLivesAndLevel(m) {
  const { regs, mem } = m;

  // The caller's count, captured before the guard exactly as the hardware does, and dead if the
  // guard skips. It is "lives currently in play"; callers pass 1.
  const livesInPlay = regs.a & 0xff;

  // Maintain the HUD only while a credited game is in progress; in attract the guard skips the
  // entire body, writing nothing.
  if (!gameActiveGuard(m)) return;

  // Blank all six marker slots, bottom cell upward.
  let cell = MARKER_BOTTOM;
  for (let i = 0; i < MARKER_SLOTS; i++) {
    mem.write8(cell, TILE_BLANK);
    cell = (cell - MARKER_ROW_STEP) & 0xffff;
  }

  // One marker per reserve life (LIVES minus the caller's count, 8-bit), bottom upward. Equal
  // counts give zero markers.
  const reserve = (mem.read8(LIVES) - livesInPlay) & 0xff;
  if (reserve !== 0) {
    cell = MARKER_BOTTOM;
    for (let i = 0; i < reserve; i++) {
      mem.write8(cell, TILE_MARKER);
      cell = (cell - MARKER_ROW_STEP) & 0xffff;
    }
  }

  // Fixed furniture.
  for (const [addr, tile] of FURNITURE) mem.write8(addr, tile);

  // Clamp the level to 99, writing back only when it exceeds.
  let level = mem.read8(LEVEL);
  if (level > LEVEL_MAX) {
    level = LEVEL_MAX;
    mem.write8(LEVEL, LEVEL_MAX);
  }

  // Split into decimal digits by repeated subtraction of ten: `tens` counts the subtractions
  // taken before the value would borrow, and the last subtraction is undone.
  let tens = 0xff;
  let units = level;
  let borrow;
  do {
    tens = (tens + 1) & 0xff;
    borrow = units < 10; // the subtraction borrows when the running value is below ten
    units = (units - 10) & 0xff;
  } while (!borrow);
  units = (units + 10) & 0xff;

  mem.write8(LEVEL_UNITS_CELL, units);
  mem.write8(LEVEL_TENS_CELL, tens);
}
