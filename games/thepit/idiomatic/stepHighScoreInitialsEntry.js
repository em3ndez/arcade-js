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
 * map to each direction, interleaved in priority. The caller passes the cursors and codes in
 * registers and re-reads the stepped index from register C.
 */
import { IN0_DEBOUNCED, PLAY_PHASE_COUNTER, INITIALS_REMAINING } from "./names.js";
import { stepInitialDown } from "./stepInitialDown.js";
import { advanceInitialUp } from "./advanceInitialUp.js";
import { requestSound16 } from "./requestSound16.js";
import { waitFrames } from "./waitFrames.js";

const TILEMAP_ROW = 32; // one tilemap row is 32 cells; "up one row" steps a cursor back 32
const INDEX_HOME = 10; // the index/blank byte's home value, re-seated after a commit
const HOLD_FRAMES = 20; // frames to hold after a committed move before returning

export function* stepHighScoreInitialsEntry(m) {
  const { regs, mem8 } = m;
  const actionBits = mem8[IN0_DEBOUNCED];

  // First-match-wins over the low five action bits, tested in priority order.
  if (actionBits & 0x01) { regs.c = stepInitialDown(m, regs.c); return m.ret(); }
  if (actionBits & 0x02) { regs.c = advanceInitialUp(m, regs.c); return m.ret(); }
  if (actionBits & 0x04) { regs.c = stepInitialDown(m, regs.c); return m.ret(); }
  if (actionBits & 0x08) { regs.c = advanceInitialUp(m, regs.c); return m.ret(); }
  if (!(actionBits & 0x10)) return m.ret();

  // Commit: the blank code stamps over the vacated cells; the object code is redrawn one row up.
  const blankCode = regs.c;
  const objectCode = regs.b;

  mem8[regs.hl] = blankCode; // blank both current cells
  mem8[regs.ix] = blankCode;

  regs.hl = regs.hl - TILEMAP_ROW; // step every cursor up one row
  regs.de = regs.de - TILEMAP_ROW;
  regs.ix = regs.ix + 1;
  regs.c = INDEX_HOME; // re-seat the index/blank byte for the caller's next pass

  mem8[regs.de] = objectCode;

  mem8[INITIALS_REMAINING] = mem8[INITIALS_REMAINING] - 1;
  mem8[PLAY_PHASE_COUNTER] = 0;

  requestSound16(m);
  return yield* waitFrames(m, HOLD_FRAMES); // hold, then return to the caller
}
