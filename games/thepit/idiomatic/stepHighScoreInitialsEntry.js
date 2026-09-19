// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepHighScoreInitialsEntry — per-frame action dispatch for a two-cell (vertically stacked)
 * object, keyed on the low five action bits of the debounced input byte IN0_DEBOUNCED.
 *
 * The object spans two tilemap cells; the caller tracks it with two cursors plus a parallel
 * cursor into its colour plane, and carries the object's tile code and a blank/index byte. Each
 * frame this takes the first matching action in fixed priority order: a step-down bit nudges the
 * cyclic index down a notch, a step-up bit nudges it up (both with a step sound), and the commit
 * bit moves the object up one tilemap row (32 cells) — blank both current cells, redraw one row
 * higher in the parallel plane, count the move off INITIALS_REMAINING, restart PLAY_PHASE_COUNTER,
 * play the move sound, and hold a fixed number of frames; no action bit does nothing. Two bits
 * map to each direction, interleaved in priority. The caller passes the cursors and codes
 * ({ c, b, hl, ix, de }) in and reads back the stepped set ({ c, hl, ix, de }).
 */
import { IN0_DEBOUNCED, PLAY_PHASE_COUNTER, INITIALS_REMAINING } from "./names.js";
import { stepInitialDown } from "./stepInitialDown.js";
import { advanceInitialUp } from "./advanceInitialUp.js";
import { requestSound16 } from "./requestSound16.js";
import { waitFrames } from "./waitFrames.js";

const TILEMAP_ROW = 32; // one tilemap row is 32 cells; "up one row" steps a cursor back 32
const INDEX_HOME = 10; // the index/blank byte's home value, re-seated after a commit
const HOLD_FRAMES = 20; // frames to hold after a committed move before returning

export function* stepHighScoreInitialsEntry(m, cursors) {
  const { mem8 } = m;
  const actionBits = mem8[IN0_DEBOUNCED];
  let { c, b, hl, ix, de } = cursors;

  // First-match-wins over the low five action bits, tested in priority order.
  if (actionBits & 0x01) { c = stepInitialDown(m, c); return { c, hl, ix, de }; }
  if (actionBits & 0x02) { c = advanceInitialUp(m, c); return { c, hl, ix, de }; }
  if (actionBits & 0x04) { c = stepInitialDown(m, c); return { c, hl, ix, de }; }
  if (actionBits & 0x08) { c = advanceInitialUp(m, c); return { c, hl, ix, de }; }
  if (!(actionBits & 0x10)) return { c, hl, ix, de };

  // Commit: the blank code stamps over the vacated cells; the object code is redrawn one row up.
  const blankCode = c;
  const objectCode = b;

  mem8[hl] = blankCode; // blank both current cells
  mem8[ix] = blankCode;

  hl = hl - TILEMAP_ROW; // step every cursor up one row
  de = de - TILEMAP_ROW;
  ix = ix + 1;
  c = INDEX_HOME; // re-seat the index/blank byte for the caller's next pass

  mem8[de] = objectCode;

  mem8[INITIALS_REMAINING] = mem8[INITIALS_REMAINING] - 1;
  mem8[PLAY_PHASE_COUNTER] = 0;

  requestSound16(m);
  yield* waitFrames(m, HOLD_FRAMES); // hold, then return the stepped cursors to the caller
  return { c, hl, ix, de };
}
