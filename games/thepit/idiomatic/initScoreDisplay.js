// SPDX-License-Identifier: GPL-3.0-only
/**
 * initScoreDisplay — blank the numeric-readout strip, seed three zeroed readout records, then
 * render them. Runs once at cold boot to bring up a clean numeric readout — the row of three
 * on-screen numbers the score formatter draws. It reads nothing on entry (every base and value
 * is hardwired): it blanks the 32-cell strip at SCORE_READOUT_STRIP with the blank tile so no
 * stale digit shows through, seeds three fixed label+zero records so all three numbers start
 * blank, then tail-hands to the readout formatter, whose return unwinds to this caller. Which
 * three numbers the readout holds is not confirmed, so the name stays neutral.
 */

import { renderScoreReadouts } from "./renderScoreReadouts.js";
import { SCORE_READOUT_STRIP, HIGH_SCORE_TABLE } from "./names.js";

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
    const base = HIGH_SCORE_TABLE + r * READOUT_RECORD.length;
    for (let i = 0; i < READOUT_RECORD.length; i++) mem8[base + i] = READOUT_RECORD[i];
  }

  // Render: hand off to the score-readout formatter, whose return unwinds to our caller.
  return renderScoreReadouts(m);
}
