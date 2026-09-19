// SPDX-License-Identifier: GPL-3.0-only
/**
 * revealTerrainColumn — reveal the next column of the scrolling terrain backdrop on its
 * frame gate, then hand off to the background phase clock.
 *
 * The dirt/terrain backdrop is scrolled into view one vertical column at a time, but only on
 * the frames a reveal gate lets through, and this routine always continues into the phase clock
 * afterward. The gate counts down once per call; on any frame it has not reached zero nothing
 * is revealed. When it reaches zero it reloads from its period and steps a table cursor back one
 * 6-tile column through the terrain pattern table; if the cursor runs off the start of the table
 * the reveal is finished. Otherwise the cursor's 6 tiles are stamped up one video-RAM column —
 * bottom cell first, one tile-row higher each byte — bringing the next column in. Whichever arm
 * it takes it hands off to advanceChamberCreatureAnimation, the phase clock, whose return unwinds
 * to this routine's caller, so the hand-off IS this routine's exit. The name is best-effort.
 */

import { advanceChamberCreatureAnimation } from "./advanceChamberCreatureAnimation.js";
import {
  PATTERN_SOURCE_PTR,
  PIT_FLOOR_REVEAL_COLUMN_BOTTOM,
  PIT_FLOOR_REVEAL_CURSOR,
  PIT_FLOOR_REVEAL_GATE,
  PIT_FLOOR_REVEAL_PATTERN_TABLE,
  PIT_FLOOR_REVEAL_PERIOD,
} from "./names.js";


// The terrain pattern table: each column is 6 consecutive tile codes.
const TILES_PER_COLUMN = 6;

// The video-RAM cell of the column's bottom tile; each tile above sits one row (32 cells) higher.
const COLUMN_BOTTOM_CELL = PIT_FLOOR_REVEAL_COLUMN_BOTTOM;
const ONE_ROW_UP = 32;

export function revealTerrainColumn(m) {
  const { mem8, mem16 } = m;

  // Tick the reveal gate; act only on the frame it counts down to zero.
  const gate = (mem8[PIT_FLOOR_REVEAL_GATE] - 1 + 256) % 256;
  mem8[PIT_FLOOR_REVEAL_GATE] = gate;
  if (gate !== 0) {
    // Not a reveal frame — straight on to the phase clock.
    return advanceChamberCreatureAnimation(m);
  }

  // Reload the gate from its period and step the cursor back one column.
  mem8[PIT_FLOOR_REVEAL_GATE] = mem8[PIT_FLOOR_REVEAL_PERIOD];
  const cursor = mem8[PIT_FLOOR_REVEAL_CURSOR] - TILES_PER_COLUMN;
  if (cursor < 0) {
    // Ran off the start of the pattern table — the reveal is done, draw nothing.
    return advanceChamberCreatureAnimation(m);
  }
  mem8[PIT_FLOOR_REVEAL_CURSOR] = cursor;

  // Stash the source pointer (scratch the backdrop machinery leaves), then stamp 6 tiles up.
  const source = PIT_FLOOR_REVEAL_PATTERN_TABLE + cursor;
  mem16[PATTERN_SOURCE_PTR] = source;
  let cell = COLUMN_BOTTOM_CELL;
  for (let i = 0; i < TILES_PER_COLUMN; i++) {
    mem8[cell] = mem8[source + i];
    cell -= ONE_ROW_UP;
  }

  // Hand off to the phase clock; its return unwinds to our caller, so this is the exit.
  return advanceChamberCreatureAnimation(m);
}
