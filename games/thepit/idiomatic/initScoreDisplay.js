// SPDX-License-Identifier: GPL-3.0-only
/**
 * initScoreDisplay — blank the numeric-readout strip, seed three zeroed readout records, then
 * render them.  ROM 0x4bc7.
 *
 * Runs once at cold boot (called from the cold-boot init) to bring up a clean numeric
 * readout — the row of three on-screen numbers the score formatter draws. It does two
 * fixed setups, reading nothing on entry (every base and value is hardwired), then hands
 * off to render:
 *   - Blanks the 32-cell display strip at 0x8280 by filling every cell with the blank
 *     tile, so no stale digit shows through before the readout is drawn.
 *   - Seeds the three source records at 0x8039 — each a fixed 3-tile label block followed
 *     by a two-byte value, here left at zero — so all three readout numbers start blank/zero.
 * Then it tail-hands to the decompiled score-readout formatter (renderScoreReadouts, 0x4cca),
 * which copies each record's label block into its display cell and formats each value into
 * digit cells.
 * That formatter's return unwinds to this routine's caller, so the tail hand-off is the
 * exit and is returned straight through.
 *
 * The formatter reads only the records this routine just seeded (and sets up its own
 * pointers), so no register is handed across the boundary — the tail call needs no
 * register marshalling.
 *
 * Name kept neutral: the action — clear the readout strip, seed three zero records, render
 * them — is clear, but which three numbers this readout holds (and what the label tiles
 * spell) is not confirmed to the naming bar, so it earns no specific English name yet.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4bc7.test.js.
 * GATE:     real dispatch — fires once during boot (from the cold-boot init). Straight-
 *           line (blank the strip, seed the records, tail-hand to the formatter), so that
 *           one entry covers the whole path, and both sides run through the same still-
 *           oracle formatter so SP/pc land identically. Teeth: a twin filling the strip
 *           with the wrong tile (caught in the un-rendered strip cells) and a twin seeding
 *           a non-zero record value (caught in the rendered digit cells).
 * LIVE-OUT: memory-only — the 32 blanked strip cells, the three seeded records, and every
 *           cell the formatter draws (all through the same still-oracle body on both sides);
 *           SP/pc land where its return goes. No register or flag is live out — the oracle's
 *           residual pointer/counter are dead scratch the formatter and callers reload.
 * NAMES:    SCORE_READOUT_STRIP (0x8280, the readout display strip) from ram.js; 0x8039
 *           (readout source records) stays hex — not yet named in ram.js. BLANK_TILE (36)
 *           matches the score digit formatter's leading-zero blank.
 */

import { renderScoreReadouts } from "./renderScoreReadouts.js";
import { SCORE_READOUT_STRIP } from "./ram.js";

// The blank display tile — same value the score digit formatter uses to blank a cell.
const BLANK_TILE = 36;

// One readout source record: a fixed 3-tile label block, then a two-byte value (zero here).
const READOUT_RECORD = [16, 10, 22, 0, 0];

export function initScoreDisplay(m) {
  const { mem8 } = m;

  // Blank the 32-cell numeric-readout display strip so no stale digit shows through.
  for (let i = 0; i < 32; i++) mem8[SCORE_READOUT_STRIP + i] = BLANK_TILE;

  // Seed the three readout source records back to back, each label + zero value.
  for (let r = 0; r < 3; r++) {
    const base = 0x8039 + r * READOUT_RECORD.length;
    for (let i = 0; i < READOUT_RECORD.length; i++) mem8[base + i] = READOUT_RECORD[i];
  }

  // Render: hand off to the score-readout formatter, whose return unwinds to
  // our caller, so this tail hand-off is the exit.
  return renderScoreReadouts(m);
}
