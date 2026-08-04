// SPDX-License-Identifier: GPL-3.0-only
/**
 * gameActiveGuard — caller-skip guard: proceed only while a credited game is in play.
 *
 * A routine whose body must run during a real game but be skipped during the attract demo
 * asks this first and bails out when it says no: `if (!gameActiveGuard(m)) return;`.
 * true = proceed (a credited game is in progress), false = skip the caller's remainder.
 *
 * The decision is bit 0 of ATTRACT, which is non-zero while NO credited game is running
 * and drops to 0 once a coin has been accepted. ATTRACT only ever holds 0 or 1, so bit 0
 * is the whole flag.
 *
 * THE POLARITY IS THE TRAP. The game's other caller-skip guard — the one keyed on whether
 * Mario is alive — proceeds when ITS flag bit is SET; this one proceeds when the bit is
 * CLEAR. Read the wrong way round it inverts every caller that uses it.
 *
 * A LEAF — reads one byte, writes nothing, calls nothing.
 *
 * LIVE-OUT: the proceed/skip boolean. No memory is written.
 */

import { ATTRACT } from "./names.js";

export function gameActiveGuard(m) {
  // Bit 0 of ATTRACT: the guard proceeds (returns true) exactly when that bit is
  // CLEAR — not in the attract demo, so a credited game is in progress and the
  // caller's remainder should run.
  return (m.mem.read8(ATTRACT) & 0x01) === 0;
}
