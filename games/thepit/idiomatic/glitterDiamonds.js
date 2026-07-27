// SPDX-License-Identifier: GPL-3.0-only
/**
 * glitterDiamonds — cycle the colour of the on-screen diamond cells so they glitter:
 * each frame advance one diamond cell's colour attribute through the palette; a diamond
 * that has been collected drops out of the set and holds a fixed colour.  ROM 0x06ac.
 *
 * A free-running countdown at GLITTER_COUNTDOWN (0x805c) runs 8 → 7 → ... → 1 and reloads to 8 when it
 * reaches 0, so it repeats on a fixed eight-frame period. Each value it passes
 * through names one fixed screen cell — a colour-RAM byte paired with the video-RAM
 * byte that holds the glyph currently shown at that cell. For that one cell:
 *   - if the shown glyph is the cell's "animating" glyph, its colour attribute
 *     steps to the next of eight shades — the running colour flash;
 *   - otherwise the cell is pinned to its resting colour (3 or 7).
 * The value-4 step and the wrap-through-0 both land on the same cell, so seven
 * distinct cells share the eight-frame cycle. Any countdown value outside 2..7
 * falls to the value-1 cell.
 *
 * Called once per main-loop pass (loc_0348) as a decorative recolour; it takes no
 * caller input beyond the countdown and screen bytes it reads, and returns nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-06ac.test.js.
 * GATE:     crafted-entry — real captured main-loop dispatches (the countdown at
 *           its natural values) plus a crafted sweep over every countdown value and
 *           both recolour branches (glyph animating vs resting), with the colour
 *           seeded to cross the eight-shade wrap. Teeth on the sweep.
 * LIVE-OUT: memory-only — the caller overwrites every register this leaves before
 *           reading it, so nothing is live out; SP/pc are the modelled return the
 *           direct-call layer drops.
 * NAMES:    GLITTER_COUNTDOWN (0x805c) from ram.js is the countdown work-RAM byte; the
 *           cell targets are colour/video RAM outside ram.js's work-RAM map and stay hex.
 */

import { GLITTER_COUNTDOWN } from "./ram.js";

// Countdown value → the cell it recolours:
//   [ colour-RAM cell (written), video-RAM cell (read), animating glyph, resting colour ]
const CELLS = {
  7: [0x8873, 0x9073, 0x3a, 7],
  6: [0x895d, 0x915d, 0x3b, 3],
  5: [0x88d9, 0x90d9, 0x3a, 7],
  4: [0x89fd, 0x91fd, 0x3c, 3],
  3: [0x89b6, 0x91b6, 0x3a, 7],
  2: [0x8a7d, 0x927d, 0x3d, 3],
};
// Countdown value 1, and any stray value outside 2..7.
const CELL_DEFAULT = [0x8b3a, 0x933a, 0x3a, 7];

function recolorCell(m, colourCell, tileCell, animatingGlyph, restingColor) {
  const { mem8 } = m;
  if (mem8[tileCell] === animatingGlyph) {
    // Glyph animating: advance the colour attribute one shade of eight.
    mem8[colourCell] = (mem8[colourCell] + 1) % 8;
  } else {
    // Glyph idle: hold the cell at its resting colour.
    mem8[colourCell] = restingColor;
  }
}

export function glitterDiamonds(m) {
  const { mem8 } = m;

  // Step the countdown one and store it back; the value it now holds selects the
  // cell recoloured below. (In play it runs 8..1; the byte store wraps for free.)
  const countdown = mem8[GLITTER_COUNTDOWN] - 1;

  if (countdown === 0) {
    // Wrapped: reload for the next cycle, then recolour the shared value-4 cell.
    mem8[GLITTER_COUNTDOWN] = 8;
    recolorCell(m, ...CELLS[4]);
    return;
  }

  mem8[GLITTER_COUNTDOWN] = countdown;
  recolorCell(m, ...(CELLS[countdown] ?? CELL_DEFAULT));
}
