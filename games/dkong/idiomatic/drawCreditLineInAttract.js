// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawCreditLineInAttract — repaint the "CREDIT nn" line, but only while no credited
 * game is in progress (attract).
 *
 * A task-table entry that is really a one-bit enable guard in front of the credit-line
 * painter. It reads ATTRACT — non-zero while no credited game is running (power-on
 * attract and after game over), zero once a coin is accepted — and tests its low bit:
 *
 *   • bit CLEAR (a credited game is in play) — do nothing, leave the line alone.
 *   • bit SET   (attract) — repaint the whole "CREDIT nn" line: the "CREDIT" label plus
 *                the current credit count.
 *
 * So the credit line is refreshed only on the attract/idle screens, which is where it is
 * shown. The same bit-0-of-ATTRACT test guards in-game work elsewhere, wired the other
 * way round: that one proceeds while a game IS active, this one while it is not.
 *
 * The painter loads all of its own inputs (the string index and the credit source
 * cell), so nothing is passed to it — there is no register handoff to marshal.
 *
 * LIVE-OUT: memory-only. This is a task-table entry: the dispatcher discards whatever
 * the routine leaves in registers and flags. The real output is the credit line's video
 * cells, written inside the painter.
 */

import { ATTRACT } from "./names.js";
import { drawCreditDisplay } from "./drawCreditDisplay.js";

export function drawCreditLineInAttract(m) {
  const { mem } = m;

  // Enable guard on bit 0 of ATTRACT: while a credited game is in progress the bit is
  // clear, and the credit line is left untouched.
  if ((mem.read8(ATTRACT) & 0x01) === 0) return;

  // Attract (no credited game): repaint the "CREDIT nn" line.
  drawCreditDisplay(m);
}
