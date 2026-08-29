// SPDX-License-Identifier: GPL-3.0-only
import { loc_7eb2 } from "./loc_7eb2.js";
import { loc_7f0e } from "./loc_7f0e.js";
import { loc_7f5d } from "./loc_7f5d.js";
import { startGameOnStartButtonPress } from "./startGameOnStartButtonPress.js";
import { RESET_SCAN_LATCH, HIGH_SCORE_INSERT_RANK, WRITE_ANIM_HANDLER_SELECT } from "./names.js";

/**
 * loc_7e94 — the write-anim dispatch redirect, a per-frame pre-pass.
 *
 * A run-once latch (RESET_SCAN_LATCH) gates the write animation: once it is set the dispatch is
 * skipped, and while HIGH_SCORE_INSERT_RANK is zero the latch is armed and the dispatch skipped.
 * Otherwise a selector byte picks one of three write-anim state handlers. Every path then
 * tail-returns into the per-frame start-button poll startGameOnStartButtonPress, so it runs last.
 *
 * LIVE-OUT: memory only.
 */
export function loc_7e94(m) {
  const { mem8 } = m;

  if (mem8[RESET_SCAN_LATCH] !== 0) return startGameOnStartButtonPress(m);
  if (mem8[HIGH_SCORE_INSERT_RANK] === 0) {
    mem8[RESET_SCAN_LATCH] = 1; // arm the run-once latch
    return startGameOnStartButtonPress(m);
  }

  switch (mem8[WRITE_ANIM_HANDLER_SELECT]) {
    case 0:
      loc_7eb2(m);
      break;
    case 1:
      loc_7f0e(m);
      break;
    case 2:
      loc_7f5d(m);
      break;
  }
  return startGameOnStartButtonPress(m);
}
