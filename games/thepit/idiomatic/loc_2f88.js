// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2f88 — reveal the next column of the scrolling terrain backdrop on its frame
 * gate, then hand off to the background phase clock.  ROM 0x2f88.
 *
 * The dirt/terrain backdrop is scrolled into view one vertical column at a time.
 * This routine advances that reveal by a single column, but only on the frames its
 * gate lets through, and then always continues into the phase clock:
 *
 *   - A reveal gate counts down once per call. On any frame it has not yet reached
 *     zero, nothing is revealed this frame — the routine hands straight off to the
 *     phase clock.
 *   - When the gate reaches zero it reloads from its period and steps a table cursor
 *     back one 6-tile column through the terrain pattern table. If the cursor runs
 *     off the start of the table the reveal is finished, so again nothing is drawn.
 *   - Otherwise the cursor's 6 tiles are stamped up one video-RAM column — bottom
 *     cell first, one tile-row higher each byte — bringing the next column of
 *     terrain into the backdrop.
 *
 * Whichever arm it takes it ends by handing off to loc_2fc0, the background phase
 * clock; that routine tail-jumps onward and its return unwinds straight back to
 * loc_2f88's caller, so the hand-off IS this routine's exit. loc_2fc0 is already
 * decompiled, so it is called directly rather than through the oracle registry.
 *
 * This is the standalone, callable form of the same reveal that the per-frame
 * backdrop monolith loc_2f71 also carries inline; the standalone form is never
 * dispatched in attract, which shapes the gate below.
 *
 * Name kept as loc_2f88: this backdrop-reveal subsystem is a best-effort reading and
 * none of the counters it touches is a confirmed, named work-RAM field yet — below
 * the bar to promote to an English name (its siblings loc_2fc0/loc_2fd9 stay loc_
 * for the same reason).
 *
 * Memory-equivalent to the frozen oracle — equivalence-2f88.test.js.
 * GATE:     crafted-entry — loc_2f88 is never dispatched in attract (the monolith
 *           loc_2f71 inlines the same body instead of calling it), so real machine
 *           states are captured at loc_2f71's entry and loc_2f88 is run on clones of
 *           them; the two still-untranslated continuations reached through loc_2fc0
 *           (0x2fe3 oscillator body, 0x3029 publish tail) are delegated to one
 *           identical stub each, installed on both sides at once. EQUAL over every
 *           captured state plus an exhaustive sweep of the gate byte crossed with
 *           representative cursor and phase values, reaching all three arms; the
 *           teeth twins are caught.
 * LIVE-OUT: memory-only — the gate byte, the reloaded cursor, the stashed pattern
 *           pointer, and the 6 stamped video-RAM tiles; the routine tail-jumps, so
 *           its caller consumes no register and the phase clock owns everything after
 *           the hand-off, identically both sides. Leftover registers/flags are dead.
 * NAMES:    none from ram.js — the reveal gate (0x80e5), its reload period (0x80e4),
 *           the table cursor (0x80e6) and the stashed pattern pointer (0x80e1) are
 *           all still unnamed. Delegates to the decompiled loc_2fc0.
 */

import { loc_2fc0 } from "./loc_2fc0.js";

// The terrain pattern table: each column is 6 consecutive tile codes.
const PATTERN_TABLE = 0x3048;
const TILES_PER_COLUMN = 6;

// The video-RAM cell of the column's bottom tile; each tile above it sits one
// tile-row (32 cells) higher in memory.
const COLUMN_BOTTOM_CELL = 0x938c;
const ONE_ROW_UP = 32;

export function loc_2f88(m) {
  const { mem } = m;

  // Tick the reveal gate; act only on the frame it counts down to zero.
  const gate = (mem.read8(0x80e5) - 1 + 256) % 256;
  mem.write8(0x80e5, gate);
  if (gate !== 0) {
    // Not a reveal frame — straight on to the phase clock.
    return loc_2fc0(m);
  }

  // Reload the gate from its period and step the cursor back one column.
  mem.write8(0x80e5, mem.read8(0x80e4));
  const cursor = mem.read8(0x80e6) - TILES_PER_COLUMN;
  if (cursor < 0) {
    // Ran off the start of the pattern table — the reveal is done, draw nothing.
    return loc_2fc0(m);
  }
  mem.write8(0x80e6, cursor);

  // Remember where this column came from in the pattern table (a scratch pointer
  // the backdrop machinery leaves behind), then stamp its 6 tiles up the column.
  const source = PATTERN_TABLE + cursor;
  mem.write16(0x80e1, source);
  let cell = COLUMN_BOTTOM_CELL;
  for (let i = 0; i < TILES_PER_COLUMN; i++) {
    mem.write8(cell, mem.read8(source + i));
    cell -= ONE_ROW_UP;
  }

  // Hand off to the phase clock; its return unwinds to our caller, so this is the exit.
  return loc_2fc0(m);
}
