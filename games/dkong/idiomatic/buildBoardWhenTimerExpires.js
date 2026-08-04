// SPDX-License-Identifier: GPL-3.0-only
/**
 * buildBoardWhenTimerExpires — gated board (re)build: tick the sub-state countdown and
 * build the board only on the frame the countdown expires.
 *
 * The in-play entry to the board builder, dispatched under the vblank service while
 * the game sub-state is the board-setup value. Every frame it counts the sub-state
 * timer down by one; while that timer is still above zero it does nothing this frame,
 * and only on the tick that brings it to zero does it run the full board build.
 * Polarity matters: the build fires on EXPIRY, not while counting — reading the gate
 * the other way inverts the whole routine.
 *
 * (The board builder also has a second, ungated entry, used for the timed advance into
 * the 25m board; this one is the countdown-gated entry.)
 *
 * LIVE-OUT: memory-only — the ticked sub-state timer and, on expiry, everything the
 * board build writes, including the palette-bank output latch the display reads to
 * pick its colour set.
 */

import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { buildBoard } from "./buildBoard.js";

export function buildBoardWhenTimerExpires(m) {
  // Tick the sub-state countdown; build the board only on the frame it expires.
  if (!tickSubstateTimer(m)) return; // still counting down — nothing to do this frame
  buildBoard(m);
}
