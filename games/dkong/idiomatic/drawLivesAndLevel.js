// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawLivesAndLevel — redraw the reserve-lives indicator and the level-number
 * digits.  ROM 0x06B8.
 *
 * The top-of-screen HUD shows how many spare Marios are left (a vertical column
 * of marker tiles) and the current level number. This routine repaints both. It
 * is task 6 of the main-loop task table (0x0307) and also the tail of the
 * extra-life award (sub_0350), which bumps LIVES then jumps here to refresh the
 * column; state-0 init (handler_01c3) calls it once as well. All three known
 * call sites pass A = 1.
 *
 * In order:
 *   1. A `rst 0x08` guard (gameActiveGuard) skips the whole body during attract —
 *      the HUD is only maintained while a credited game is in progress.
 *   2. Blank all six marker slots to the empty tile 0x10, stepping one tilemap
 *      row (0x20 bytes) UP from the bottom slot 0x7783.
 *   3. Fill one marker tile (0xFF) per RESERVE life — LIVES minus the input A —
 *      from the bottom up. A is "lives currently in play" (the active Mario, so
 *      the callers pass 1, giving LIVES-1 reserve markers). When LIVES == A the
 *      count is zero and no marker is drawn (the oracle's `jp z`).
 *   4. Stamp two fixed furniture tiles beside the indicator.
 *   5. Clamp the level number (LEVEL, 0x6229) to 99, writing the clamp back only
 *      when it exceeds, then split it into two decimal digits by repeated
 *      subtraction of ten (the ROM avoids DAA) and write tens/units into two
 *      adjacent tilemap columns.
 *
 * The marker fill count is 8-bit like the ROM's `sub c`, so a caller that passed
 * A > LIVES would wrap to a large count and paint far past the six slots — the
 * oracle does exactly that, and this reproduces it; in real play A is always 1
 * and LIVES is 1..6.
 *
 * Memory-equivalent to the frozen oracle — equivalence-06b8.test.js.
 * GATE:     crafted-entry — real captured boot/attract dispatches reach BOTH arms
 *           (one draw with ATTRACT=0, one skip with ATTRACT=1); crafted entries
 *           broaden the draw arm across reserve counts (incl. the zero-reserve
 *           `jp z`), the level clamp edge (0x63/0x64), and the digit-split range,
 *           poking ATTRACT=0/LIVES/LEVEL/A identically on both sides. Reserve is
 *           kept 0..6 so the oracle's 8-bit fill stays in mapped video RAM. Teeth
 *           on the draw arm (a wrong marker tile).
 * LIVE-OUT: memory-only — every call site's continuation overwrites A before
 *           reading it (handler_01c3 → sub_0207's `ld a,(0x7d80)`; the task
 *           dispatcher returns to the main-loop top; sub_0350's tail return
 *           reloads), and none read a flag it leaves. SP/pc are the modelled
 *           `ret` the direct-call layer replaces with a JS return.
 * NAMES:    LIVES (0x6228), LEVEL (0x6229) from ram.js; the HUD targets are video
 *           RAM (0x7400-0x77FF), outside ram.js's work-RAM map, so they stay hex.
 */

import { LIVES, LEVEL } from "./ram.js";
import { gameActiveGuard } from "./gameActiveGuard.js";

// Reserve-lives marker column: six cells stepping one tilemap row (0x20) UP from
// the bottom cell. Reserve markers (tile 0xFF) fill from the bottom; unused
// slots hold the blank tile 0x10.
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

// Level-number digit cells (adjacent tilemap columns, 0x20 apart) and the clamp.
const LEVEL_UNITS_CELL = 0x74a3;
const LEVEL_TENS_CELL = 0x74c3;
const LEVEL_MAX = 0x63; // 99 decimal

export function drawLivesAndLevel(m) {
  const { regs, mem } = m;

  // `ld c,a`: the input, captured before the guard exactly as the ROM does
  // (dead if the guard skips). A = lives currently in play; callers pass 1.
  const livesInPlay = regs.a & 0xff;

  // `rst 0x08`: maintain the HUD only while a credited game is in progress; in
  // attract the guard skips the entire body (writes nothing).
  if (!gameActiveGuard(m)) return;

  // Blank all six marker slots, bottom cell upward.
  let cell = MARKER_BOTTOM;
  for (let i = 0; i < MARKER_SLOTS; i++) {
    mem.write8(cell, TILE_BLANK);
    cell = (cell - MARKER_ROW_STEP) & 0xffff;
  }

  // One 0xFF marker per reserve life (LIVES - livesInPlay, 8-bit like `sub c`),
  // bottom upward. Equal counts give zero markers (the oracle's `jp z`).
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

  // Split into decimal digits by repeated subtraction of ten: `tens` counts the
  // subtractions taken before the value would borrow; `add a,c` undoes the last.
  let tens = 0xff;
  let units = level;
  let borrow;
  do {
    tens = (tens + 1) & 0xff;
    borrow = units < 10; // `sub c` borrows when the running value is below ten
    units = (units - 10) & 0xff;
  } while (!borrow);
  units = (units + 10) & 0xff;

  mem.write8(LEVEL_UNITS_CELL, units);
  mem.write8(LEVEL_TENS_CELL, tens);
}
