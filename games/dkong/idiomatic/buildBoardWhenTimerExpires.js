// SPDX-License-Identifier: GPL-3.0-only
/**
 * buildBoardWhenTimerExpires — gated board (re)build. The in-play entry, dispatched under the
 * vblank service while the game sub-state is the board-setup value. Each frame it ticks the
 * sub-state timer down; only on the tick that reaches zero does it run the full board build.
 * Polarity matters: the build fires on EXPIRY, not while counting — reading the gate the other way
 * inverts the routine. (The builder also has a second, ungated entry, used for the timed advance
 * into the 25m board.)
 * LIVE-OUT: memory-only — the ticked timer and, on expiry, everything the board build writes,
 * including the palette-bank output latch the display reads to pick its colour set.
 */

import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { buildBoard } from "./buildBoard.js";

export function buildBoardWhenTimerExpires(m) {
  if (!tickSubstateTimer(m)) return; // still counting down
  buildBoard(m);
}
