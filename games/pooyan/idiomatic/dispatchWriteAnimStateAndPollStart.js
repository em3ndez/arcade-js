// SPDX-License-Identifier: GPL-3.0-only
import { seedWriteAnimWorkBlock } from "./seedWriteAnimWorkBlock.js";
import { advanceWriteAnimTileIndexOnCountdown } from "./advanceWriteAnimTileIndexOnCountdown.js";
import { appendWriteAnimBlockRowOnPhase } from "./appendWriteAnimBlockRowOnPhase.js";
import { startGameOnStartButtonPress } from "./startGameOnStartButtonPress.js";
import { RESET_SCAN_LATCH, HIGH_SCORE_INSERT_RANK, WRITE_ANIM_HANDLER_SELECT } from "./names.js";

/**
 * dispatchWriteAnimStateAndPollStart — the write-anim dispatch redirect, a per-frame pre-pass.
 *
 * A run-once latch (RESET_SCAN_LATCH) gates the write animation: once it is set the dispatch is
 * skipped, and while HIGH_SCORE_INSERT_RANK is zero the latch is armed and the dispatch skipped.
 * Otherwise a selector byte picks one of three write-anim state handlers. Every path then
 * tail-returns into the per-frame start-button poll startGameOnStartButtonPress, so it runs last.
 *
 * LIVE-OUT: memory only.
 */
export function dispatchWriteAnimStateAndPollStart(m) {
  const { mem8 } = m;

  if (mem8[RESET_SCAN_LATCH] !== 0) return startGameOnStartButtonPress(m);
  if (mem8[HIGH_SCORE_INSERT_RANK] === 0) {
    mem8[RESET_SCAN_LATCH] = 1; // arm the run-once latch
    return startGameOnStartButtonPress(m);
  }

  switch (mem8[WRITE_ANIM_HANDLER_SELECT]) {
    case 0:
      seedWriteAnimWorkBlock(m);
      break;
    case 1:
      advanceWriteAnimTileIndexOnCountdown(m);
      break;
    case 2:
      appendWriteAnimBlockRowOnPhase(m);
      break;
  }
  return startGameOnStartButtonPress(m);
}
