// SPDX-License-Identifier: GPL-3.0-only
/**
 * restartAttractDemoAt25m — on the timed sub-state advance, reset the live player context to a
 * fresh 25m / level-1 / single-life start and rebuild the board. Gated by the two-level sub-state
 * timer: the reset body runs only on the pass where both prescaler and counter expire together.
 *
 * LIVE-OUT: memory-only.
 */
import { BOARD, LIVES, LEVEL, EVENT_REQ_313C } from "./names.js";
import { tickSubstatePrescaler } from "./tickSubstatePrescaler.js";
import { buildBoard } from "./buildBoard.js";

export function restartAttractDemoAt25m(m) {
  const { mem8 } = m;

  if (!tickSubstatePrescaler(m)) return;

  mem8[0x6392] = 0; // engine scratch
  mem8[EVENT_REQ_313C] = 0;

  // Reseed the live context: 25m girders, level 1, one life.
  mem8[BOARD] = 1;
  mem8[LEVEL] = 1;
  mem8[LIVES] = 1;

  buildBoard(m);
}
