// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepHighScoreInitialsEntry — per-frame action dispatch for a two-cell (vertically stacked) object,
 * keyed on the low five action bits of the debounced input byte.  ROM 0x4eea.
 *
 * The object occupies two tilemap cells: a top cell and the cell one row directly
 * below it. The caller tracks it with two cursors — one into each cell — plus a
 * parallel cursor into a second plane (its colour cells) that moves in lockstep, and
 * carries the object's tile code and a blank/index byte. Each frame this reads the
 * action byte and takes the first matching action in fixed priority order:
 *
 *   - a step-down bit set  -> nudge the object's cyclic index down one notch (with a
 *     step sound), then return to the caller.
 *   - a step-up bit set    -> nudge the same index up one notch (with a step sound).
 *   - the commit bit set    -> move the object up one tilemap row: blank both of its
 *     current cells, redraw its code one row higher in the parallel plane, count the
 *     move off the step counter, restart the frame counter, play the move sound, and
 *     hold for a fixed number of frames before returning.
 *   - no action bit set     -> do nothing this frame.
 *
 * Two bits map to step-down and two to step-up, interleaved in priority (down, up,
 * down, up), so the cascade is tested bit by bit rather than by a combined mask. One
 * tilemap row is 32 cells, so "up one row" steps every cursor back by 32.
 *
 * The caller is still the frozen oracle: it hands the two cell cursors, the parallel
 * cursor, the object code and the blank/index byte across through machine registers,
 * and after a step it re-reads the stepped index from that same register on its next
 * pass — a genuine register boundary — so the live-ins are read off the machine and
 * the stepped index is left back in its register, and the exit returns to the caller
 * the same way.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4eea.test.js.
 * GATE:     crafted-entry — 0x4eea is never dispatched in boot/attract (its display
 *           loop is not reached over 4000 frames), so the gate runs it from a real
 *           captured sound-request state (valid stack + live sound ring) with the
 *           action byte and the object cursors poked to drive each arm: idle, both
 *           step arms (index swept, priority pinned) and the commit arm (its 20-frame
 *           hold ticked by one identical hook on both sides). Teeth catch a wrong row
 *           offset, a dropped counter decrement and a wrong move sound.
 * LIVE-OUT: memory — the blanked/redrawn cells, the decremented step counter, the
 *           cleared frame counter and the queued sound — plus the return to the caller
 *           (pc/SP); and, on the step arms only, the stepped index left in register C,
 *           which the caller re-reads next pass. The other exit registers/flags are
 *           dead and excluded from the diff.
 * NAMES:    IN0_DEBOUNCED (the action byte), PLAY_PHASE_COUNTER and INITIALS_REMAINING (0x804b,
 *           the per-move step counter) from names.js.
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
  if (actionBits & 0x01) { regs.c = stepInitialDown(m, regs.c); return m.ret(); } // step index down
  if (actionBits & 0x02) { regs.c = advanceInitialUp(m, regs.c); return m.ret(); } // step index up
  if (actionBits & 0x04) { regs.c = stepInitialDown(m, regs.c); return m.ret(); } // step index down
  if (actionBits & 0x08) { regs.c = advanceInitialUp(m, regs.c); return m.ret(); } // step index up
  if (!(actionBits & 0x10)) return m.ret(); // no action bit set -> idle

  // Commit: move the two-cell object up one tilemap row.
  const blankCode = regs.c; // the caller's blank code, stamped over the vacated cells
  const objectCode = regs.b; // the object's tile code, redrawn at its new position

  mem8[regs.hl] = blankCode; // blank the top cell
  mem8[regs.ix] = blankCode; // blank the cell one row below

  regs.hl = regs.hl - TILEMAP_ROW; // top cursor up one row
  regs.de = regs.de - TILEMAP_ROW; // parallel-plane cursor up one row
  regs.ix = regs.ix + 1;
  regs.c = INDEX_HOME; // re-seat the index/blank byte for the caller's next pass

  mem8[regs.de] = objectCode; // redraw the object one row up in the parallel plane

  mem8[INITIALS_REMAINING] = mem8[INITIALS_REMAINING] - 1; // count this move off
  mem8[PLAY_PHASE_COUNTER] = 0; // restart the frame counter

  requestSound16(m); // play the move sound
  return yield* waitFrames(m, HOLD_FRAMES); // hold the fixed number of frames, then return to the caller
}
