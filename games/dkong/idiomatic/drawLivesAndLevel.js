// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawLivesAndLevel — redraw the reserve-lives indicator (a vertical column of marker tiles) and
 * the level-number digits. Skipped during attract.
 *
 * LIVE-OUT: memory-only.
 */

import {
  LEVEL,
  LEVEL_TENS_CELL,
  LEVEL_UNITS_CELL,
  LIVES,
  RESERVE_LIVES_MARKER_BASE,
} from "./names.js";
import { gameActiveGuard } from "./gameActiveGuard.js";

const MARKER_ROW_STEP = 0x20;
const MARKER_SLOTS = 6;
const TILE_BLANK = 0x10;
const TILE_MARKER = 0xff;

const FURNITURE = [
  [0x7503, 0x1c],
  [0x74e3, 0x34],
];

const LEVEL_MAX = 0x63; // 99 decimal

export function drawLivesAndLevel(m, a = m.regs.a) {
  const { mem8 } = m;

  // Captured before the guard, exactly as the hardware does; callers pass 1 (lives in play).
  const livesInPlay = a & 0xff;

  if (!gameActiveGuard(m)) return;

  // Blank all six marker slots, bottom cell upward.
  let cell = RESERVE_LIVES_MARKER_BASE;
  for (let i = 0; i < MARKER_SLOTS; i++) {
    mem8[cell] = TILE_BLANK;
    cell = (cell - MARKER_ROW_STEP) & 0xffff;
  }

  // One marker per reserve life (LIVES minus lives in play, 8-bit), bottom upward.
  const reserve = (mem8[LIVES] - livesInPlay) & 0xff;
  if (reserve !== 0) {
    cell = RESERVE_LIVES_MARKER_BASE;
    for (let i = 0; i < reserve; i++) {
      mem8[cell] = TILE_MARKER;
      cell = (cell - MARKER_ROW_STEP) & 0xffff;
    }
  }

  for (const [addr, tile] of FURNITURE) mem8[addr] = tile;

  let level = mem8[LEVEL];
  if (level > LEVEL_MAX) {
    level = LEVEL_MAX;
    mem8[LEVEL] = LEVEL_MAX;
  }

  // Split into decimal digits by repeated subtraction of ten; the last subtraction is undone.
  let tens = 0xff;
  let units = level;
  let borrow;
  do {
    tens = (tens + 1) & 0xff;
    borrow = units < 10;
    units = (units - 10) & 0xff;
  } while (!borrow);
  units = (units + 10) & 0xff;

  mem8[LEVEL_UNITS_CELL] = units;
  mem8[LEVEL_TENS_CELL] = tens;
}
