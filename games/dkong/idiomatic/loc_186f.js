// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_186f — one timer-gated step of the board-advance interlude: hold a pose until
 * SUBSTATE_TIMER expires, then copy this step's ten-record sprite-object frame over the block,
 * pulse a sound-trigger shadow for three frames, and advance the step selector.
 *
 * LIVE-OUT: memory-only, all in work RAM — the interlude timer, the sprite-object block, the
 * sound shadow and the step selector.
 */

import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { SUBSTATE_TIMER, SND_TRIGGER, BOARD_ADVANCE_STEP } from "./names.js";

const COPY_SOURCE = 0x3a1f; // this step's ten-record sprite-object frame
const SND_LATCH = SND_TRIGGER + 4; // the sound-trigger shadow this step pulses
const SND_ASSERT_FRAMES = 0x03; // frames it stays asserted; the sound service counts it down

export function loc_186f(m) {
  const { regs, mem8 } = m;

  if (!tickSubstateTimer(m)) return;

  loadSpriteObjectBlock(m, COPY_SOURCE);

  mem8[SND_LATCH] = SND_ASSERT_FRAMES;
  mem8[BOARD_ADVANCE_STEP] = (mem8[BOARD_ADVANCE_STEP] + 1);
}
