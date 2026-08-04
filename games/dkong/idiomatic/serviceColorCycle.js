// SPDX-License-Identifier: GPL-3.0-only
/**
 * serviceColorCycle — the once-per-frame entry to the colour cycle: advance a sweep that is
 * already running, or start a fresh one at the frame-counter wrap, otherwise just repaint.
 *
 * The colour cycle is a running recolouring of a screen column. This routine is the outer gate
 * in front of the sweep that drives it, and it picks one of three things to do this frame:
 *
 *   - a sweep is already running (COLOUR_CYCLE_ACTIVE set) — step the sweep on and paint this
 *     frame's colour work;
 *   - no sweep running and the frame counter is not at its wrap (FRAME non-zero) — repaint the
 *     colour column only, with the sweep left where it is;
 *   - no sweep running AND the frame counter has just wrapped to zero — set
 *     COLOUR_CYCLE_ACTIVE and advance the fresh sweep immediately.
 *
 * So a sweep is started once per wrap of the frame counter, which is every 256 frames, and then
 * runs for its own lifetime; the driver clears the active flag when the sweep tops out and this
 * routine sets it again at the next wrap. Setting COLOUR_CYCLE_ACTIVE is the only write here —
 * every colour and sprite byte is written further down.
 *
 * Both routes out read their inputs (the active flag, the sweep counter, the board) straight
 * from memory and take nothing handed to them, so both are plain calls.
 *
 * LIVE-OUT: memory-only — COLOUR_CYCLE_ACTIVE on the wrap route, and whatever the route taken
 * writes for itself.
 */

import { COLOUR_CYCLE_ACTIVE, FRAME } from "./names.js";
import { advanceColorCycleSweep } from "./advanceColorCycleSweep.js";
import { dispatchColorCyclePaint } from "./dispatchColorCyclePaint.js";

export function serviceColorCycle(m) {
  const { mem } = m;

  // A sweep is already running: advance it and paint this frame's colour work.
  if (mem.read8(COLOUR_CYCLE_ACTIVE) !== 0) {
    advanceColorCycleSweep(m);
    return;
  }

  // No sweep running. On every frame but the frame-counter wrap, just repaint the column.
  if (mem.read8(FRAME) !== 0) {
    dispatchColorCyclePaint(m);
    return;
  }

  // Frame-counter wrap with no sweep running: arm a fresh sweep, then advance it immediately.
  mem.write8(COLOUR_CYCLE_ACTIVE, 1);
  advanceColorCycleSweep(m);
}
