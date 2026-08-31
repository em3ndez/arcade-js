// SPDX-License-Identifier: GPL-3.0-only
import { seedWriteAnimWorkBlock } from "./seedWriteAnimWorkBlock.js";
import { advanceWriteAnimTileIndexOnCountdown } from "./advanceWriteAnimTileIndexOnCountdown.js";
import { appendWriteAnimBlockRowOnPhase } from "./appendWriteAnimBlockRowOnPhase.js";
import { startGameOnStartButtonPress } from "./startGameOnStartButtonPress.js";
import { RESET_SCAN_LATCH, HIGH_SCORE_INSERT_RANK, WRITE_ANIM_HANDLER_SELECT } from "./names.js";

/**
 * dispatchWriteAnimStateAndPollStart — the write-anim dispatch redirect, a per-frame pre-pass.
 *
 * WHAT IT IS
 *   ROM 0x7e94-0x7eab. A small per-frame front-end that either steps the "write-anim" one frame
 *   or skips it, and in every case ends by running the start-button poll. The "write-anim" is the
 *   short on-screen sequence that grows a block of tiles one row at a time — the lettering that
 *   draws itself out on the high-score name-entry / round-end screen. Its live state lives in a
 *   small work block in RAM (0x8e1f..0x8e2b), and the selector WRITE_ANIM_HANDLER_SELECT (0x8e26)
 *   names which of three handlers advances that block on any given frame:
 *     0 -> seedWriteAnimWorkBlock               (set the block up for a fresh entry)
 *     1 -> advanceWriteAnimTileIndexOnCountdown (step the tile the block is drawn from)
 *     2 -> appendWriteAnimBlockRowOnPhase       (stamp one more row)
 *
 * ROLE IN THE MACHINE
 *   This routine decides, once per frame, whether the write-anim should run at all, then hands off
 *   to the per-frame start-button poll so a waiting credit can still turn into a game while the
 *   animation plays. Two gates decide the run/skip question:
 *     - RESET_SCAN_LATCH (0x8e2a) is a run-once latch. Once it is set, the write-anim is finished
 *       and the dispatch is skipped for good (until something else clears the latch).
 *     - HIGH_SCORE_INSERT_RANK (0x89fc) holds the winning rank+1 while a new high score is pending
 *       entry. While it is zero there is nothing to animate, so the latch is armed (marking the
 *       write-anim done) and the dispatch skipped. Only while a rank is pending AND the latch is
 *       still clear does the selector pick and run one handler this frame.
 *   Every path — latch set, rank zero, or a handler dispatched — tail-runs the start-button poll
 *   startGameOnStartButtonPress last, so the coin/start controls stay live throughout.
 *
 * ROM address: 0x7e94.
 * Grounding: [seen].
 * LIVE-OUT: memory only (may arm RESET_SCAN_LATCH; the chosen handler and the start poll write
 *   their own cells).
 */
export function dispatchWriteAnimStateAndPollStart(m) {
  const { mem8 } = m;

  // Gate 1 — the run-once latch. Once RESET_SCAN_LATCH (0x8e2a) is set the write-anim has already
  // finished, so there is nothing to advance: skip the dispatch entirely and go straight to the
  // per-frame start-button poll.
  if (mem8[RESET_SCAN_LATCH] !== 0) return startGameOnStartButtonPress(m);

  // Gate 2 — is a high-score entry pending? HIGH_SCORE_INSERT_RANK (0x89fc) is the winning rank+1
  // while a new score is waiting to be drawn into the table, and zero when nothing is pending. With
  // nothing to animate, the write-anim is done for this run: arm the run-once latch so this pre-pass
  // stops re-entering the state machine, then fall through to the start-button poll.
  if (mem8[HIGH_SCORE_INSERT_RANK] === 0) {
    mem8[RESET_SCAN_LATCH] = 1; // arm the run-once latch — write-anim complete, no entry pending
    return startGameOnStartButtonPress(m);
  }

  // A rank is pending and the latch is still clear, so the write-anim runs this frame. The selector
  // WRITE_ANIM_HANDLER_SELECT (0x8e26) names which stage of the animation to advance; each handler
  // reads and rewrites the shared write-anim work block (0x8e1f..0x8e2b) and steps the selector on.
  switch (mem8[WRITE_ANIM_HANDLER_SELECT]) {
    case 0:
      // State 0 (ROM 0x7eb2): seed the animation work block for a fresh high-score entry —
      // write pointer, tile index, row count, and countdown.
      seedWriteAnimWorkBlock(m);
      break;
    case 1:
      // State 1 (ROM 0x7f0e): tick the per-step countdown and, when it fires, step the tile index
      // the block draws from (otherwise it appends a row).
      advanceWriteAnimTileIndexOnCountdown(m);
      break;
    case 2:
      // State 2 (ROM 0x7f5d): stamp one more row of the growing tile block into video RAM,
      // gated by the phase ring.
      appendWriteAnimBlockRowOnPhase(m);
      break;
  }

  // Shared tail (ROM 0x7fd6): every frame ends by polling the start button, so a banked credit can
  // still start a game while the write-anim is on screen.
  return startGameOnStartButtonPress(m);
}
