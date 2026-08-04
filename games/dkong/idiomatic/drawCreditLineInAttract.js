// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawCreditLineInAttract — repaint the "CREDIT nn" line, but only while no credited
 * game is in progress (attract).  ROM 0x0611.
 *
 * A task-table entry (entry 8) that is really a one-bit enable guard in front of the
 * credit-line painter. It reads ATTRACT — non-zero while no credited game is running
 * (power-on attract and after game over), zero once a coin is accepted — and tests its
 * low bit:
 *
 *   • bit CLEAR (a credited game is in play) — do nothing, leave the line alone.
 *   • bit SET   (attract) — repaint the whole "CREDIT nn" line: the "CREDIT" label plus
 *                the current credit count, via drawCreditDisplay.
 *
 * So the credit line is refreshed only on the attract/idle screens, which is where it is
 * shown. This is the same bit-0-of-ATTRACT idiom gameActiveGuard tests, just wired the
 * other way round: gameActiveGuard proceeds while a game is active, this proceeds while it
 * is not.
 *
 * drawCreditDisplay loads all of its own inputs (the string index and the credit source
 * cell), so nothing is passed to it — there is no register handoff to marshal.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0611.test.js.
 * GATE:     capture/clone/replay of real attract dispatches (attract keeps the enable bit
 *           set, so those exercise the paint path) plus crafted entries that pin BOTH arms
 *           — the credited-game skip and the attract paint over several credit counts —
 *           identically on both sides. The RAM diff excludes the dead STACK_SCRATCH the
 *           oracle's fall-through call churns, because the direct call drops that bracket.
 *           Teeth: a twin with the enable bit inverted (paints during a game, skips in
 *           attract) and a twin that paints unconditionally.
 * LIVE-OUT: memory-only. This is a task-table entry: the dispatcher discards whatever the
 *           routine leaves in registers/flags, and the oracle's terminal return / the
 *           fall-through call's stack churn are dead ABI. The real output is the credit
 *           line's video cells, written inside drawCreditDisplay.
 * NAMES:    ATTRACT (0x6007) — from names.js. The credit-line video cells live inside
 *           drawCreditDisplay.
 */

import { ATTRACT } from "./names.js";
import { drawCreditDisplay } from "./drawCreditDisplay.js"; // ROM 0x0616

export function drawCreditLineInAttract(m) {
  const { mem } = m;

  // Enable guard on bit 0 of ATTRACT: while a credited game is in progress the bit is
  // clear, and the credit line is left untouched.
  if ((mem.read8(ATTRACT) & 0x01) === 0) return;

  // Attract (no credited game): repaint the "CREDIT nn" line.
  drawCreditDisplay(m);
}
