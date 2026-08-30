// SPDX-License-Identifier: GPL-3.0-only
import { ROUND_COUNTER, INTEGRITY_FLAG_SCAN_BASE } from "./names.js";
import { dispatchLevelIntroPhase } from "./dispatchLevelIntroPhase.js";
import { loc_0fd5 } from "./loc_0fd5.js";

/**
 * loc_1d9c — per-frame gate keyed on ROUND_COUNTER bit 1.
 *
 * Bit 1 clear: hand off to the main-loop sub-state dispatcher and return. Bit 1 set: run the
 * level-intro phase dispatcher, then a code-window integrity probe — one fixed program cell is
 * re-scanned PASSES times (an obfuscated constant check), each pass tallying 1 for bit 0 set and
 * 1 for bit 3 clear. A clean cell tallies exactly PASSES; anything else latches the integrity flag.
 *
 * LIVE-OUT: memory only — the delegated dispatcher's writes, and the integrity flag on a tamper
 * miss (the probed cell is a constant intact byte, so the miss never fires on clean code). No
 * register output.
 */

const ROUND_BIT1 = 0x02;
const PASSES = 0x20; //   the probe re-reads the same fixed cell this many times
const BIT0 = 0x01;
const BIT3 = 0x08;
// Fixed program cell scanned by the integrity probe (a constant, intact byte).
const PROBE_CELL = (0x5a << 8) | 0x28;

export function loc_1d9c(m) {
  const { mem8 } = m;

  if ((mem8[ROUND_COUNTER] & ROUND_BIT1) === 0) {
    loc_0fd5(m); // main-loop sub-state dispatcher
    return;
  }

  dispatchLevelIntroPhase(m);

  const cell = mem8[PROBE_CELL];
  let tally = 0;
  for (let i = 0; i < PASSES; i++) {
    if (cell & BIT0) tally++; //    bit 0 set
    if (!(cell & BIT3)) tally++; // bit 3 clear
  }
  if (tally !== PASSES) mem8[INTEGRITY_FLAG_SCAN_BASE] = 1;
}
