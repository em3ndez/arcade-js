// SPDX-License-Identifier: GPL-3.0-only
/**
 * revealTerrainColumn — reveal the next column of the scrolling terrain backdrop on its frame
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
 * Whichever arm it takes it ends by handing off to advanceBackgroundAnimation, the background phase
 * clock; that routine tail-jumps onward and its return unwinds straight back to
 * revealTerrainColumn's caller, so the hand-off IS this routine's exit. advanceBackgroundAnimation is already
 * decompiled, so it is called directly rather than through the oracle registry.
 *
 * This is the standalone, callable form of the same reveal that the per-frame
 * backdrop monolith advanceBackgroundSprite also carries inline; the standalone form is never
 * dispatched in attract, which shapes the gate below.
 *
 * Name kept as revealTerrainColumn: this backdrop-reveal subsystem is a best-effort reading. Three
 * of the counters it touches now carry ram.js names, but the subsystem as a whole is
 * still below the bar to promote to an English name (its siblings advanceBackgroundAnimation/setBgSpriteFrame stay
 * loc_ for the same reason).
 *
 * Memory-equivalent to the frozen oracle — equivalence-2f88.test.js.
 * GATE:     crafted-entry — revealTerrainColumn is never dispatched in attract (the monolith
 *           advanceBackgroundSprite inlines the same body instead of calling it), so real machine
 *           states are captured at advanceBackgroundSprite's entry and revealTerrainColumn is run on clones of
 *           them; the two still-untranslated continuations reached through advanceBackgroundAnimation
 *           (0x2fe3 oscillator body, 0x3029 publish tail) are delegated to one
 *           identical stub each, installed on both sides at once. EQUAL over every
 *           captured state plus an exhaustive sweep of the gate byte crossed with
 *           representative cursor and phase values, reaching all three arms; the
 *           teeth twins are caught.
 * LIVE-OUT: memory-only — the gate byte, the reloaded cursor, the stashed pattern
 *           pointer, and the 6 stamped video-RAM tiles; the routine tail-jumps, so
 *           its caller consumes no register and the phase clock owns everything after
 *           the hand-off, identically both sides. Leftover registers/flags are dead.
 * NAMES:    the reveal gate (0x80e5), its reload period (0x80e4) and the table cursor
 *           (0x80e6) are REVEAL_GATE/REVEAL_PERIOD/REVEAL_CURSOR from ram.js; the stashed
 *           pattern pointer (0x80e1) is still unnamed. Delegates to the decompiled advanceBackgroundAnimation.
 */

import { advanceBackgroundAnimation } from "./advanceBackgroundAnimation.js";
import { REVEAL_CURSOR, REVEAL_GATE, REVEAL_PERIOD } from "./ram.js";


// The terrain pattern table: each column is 6 consecutive tile codes.
const PATTERN_TABLE = 0x3048;
const TILES_PER_COLUMN = 6;

// The video-RAM cell of the column's bottom tile; each tile above it sits one
// tile-row (32 cells) higher in memory.
const COLUMN_BOTTOM_CELL = 0x938c;
const ONE_ROW_UP = 32;

export function revealTerrainColumn(m) {
  const { mem8, mem16 } = m;

  // Tick the reveal gate; act only on the frame it counts down to zero.
  const gate = (mem8[REVEAL_GATE] - 1 + 256) % 256;
  mem8[REVEAL_GATE] = gate;
  if (gate !== 0) {
    // Not a reveal frame — straight on to the phase clock.
    return advanceBackgroundAnimation(m);
  }

  // Reload the gate from its period and step the cursor back one column.
  mem8[REVEAL_GATE] = mem8[REVEAL_PERIOD];
  const cursor = mem8[REVEAL_CURSOR] - TILES_PER_COLUMN;
  if (cursor < 0) {
    // Ran off the start of the pattern table — the reveal is done, draw nothing.
    return advanceBackgroundAnimation(m);
  }
  mem8[REVEAL_CURSOR] = cursor;

  // Remember where this column came from in the pattern table (a scratch pointer
  // the backdrop machinery leaves behind), then stamp its 6 tiles up the column.
  const source = PATTERN_TABLE + cursor;
  mem16[0x80e1] = source;
  let cell = COLUMN_BOTTOM_CELL;
  for (let i = 0; i < TILES_PER_COLUMN; i++) {
    mem8[cell] = mem8[source + i];
    cell -= ONE_ROW_UP;
  }

  // Hand off to the phase clock; its return unwinds to our caller, so this is the exit.
  return advanceBackgroundAnimation(m);
}
