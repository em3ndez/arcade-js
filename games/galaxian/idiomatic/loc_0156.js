// SPDX-License-Identifier: GPL-3.0-only
// Top-level game-state handler (attract game-state): run the per-frame formation prep
// (sweep oscillator + occupancy summary), dispatch on the sequence-state selector (SEQUENCE_STATE,
// ) to one of the sub-state handlers, then finish at the post-dispatch continuation
// advanceGameStateOnCredit, the post-dispatch continuation.

// The idiomatic form ABSORBS the rst-28 computed jump into the SEQUENCE_HANDLERS table below, calling
// the named handler for each state index directly, so the push + rst-28 and its inline
// word table dissolves. The word table has 20 entries; indices 0..18 are real handlers
// (two duplicated: idx 8 == idx 2, idx 17 == idx 11), and index 19's word is — a cold-reset
// terminator sentinel, not a real handler. SEQUENCE_STATE only ever holds 0..18 in valid play, so index
// 19 (whose table word would soft-reset) and any higher index are unreachable; both are
// guarded as a hard error rather than reproduced, keeping the invariant loud and the module self-contained.
import { advanceFormationSweepOscillator } from "./advanceFormationSweepOscillator.js";
import { summarizeFormationOccupancy } from "./summarizeFormationOccupancy.js";
import { advanceGameStateOnCredit } from "./advanceGameStateOnCredit.js";
import { initSequenceEnableStarfield } from "./initSequenceEnableStarfield.js";
import { armStepCountdownAndTickSequenceTimer } from "./armStepCountdownAndTickSequenceTimer.js";
import { primeVramFillAndAdvanceStep } from "./primeVramFillAndAdvanceStep.js";
import { fillVramRowThenResetObjectState } from "./fillVramRowThenResetObjectState.js";
import { emitMessageColumnsThenAdvanceSequence } from "./emitMessageColumnsThenAdvanceSequence.js";
import { activateDescriptorSlotsThenAdvanceSequence } from "./activateDescriptorSlotsThenAdvanceSequence.js";
import { queueColumnDrawAndAdvanceSequence } from "./queueColumnDrawAndAdvanceSequence.js";
import { dwellThenAdvanceSequence } from "./dwellThenAdvanceSequence.js";
import { blankVramRowThenResetSpriteState } from "./blankVramRowThenResetSpriteState.js";
import { postCreditAndMessageDrawsAndAdvance } from "./postCreditAndMessageDrawsAndAdvance.js";
import { tickSequenceDwellTimer } from "./tickSequenceDwellTimer.js";
import { clearFlagBlockAndReseedObjectShadow } from "./clearFlagBlockAndReseedObjectShadow.js";
import { loadDescriptorAndAdvanceSequence } from "./loadDescriptorAndAdvanceSequence.js";
import { activateObjectsAndBeginPlayPhase } from "./activateObjectsAndBeginPlayPhase.js";
import { runGameplayFrameAndAdvanceOnFieldClear } from "./runGameplayFrameAndAdvanceOnFieldClear.js";
import { stepPlaySubstate6 } from "./stepPlaySubstate6.js";
import { enterSequenceStep1 } from "./enterSequenceStep1.js";
import { SEQUENCE_STATE } from "./names.js";

// The absorbed rst-28 word table: one handler per SEQUENCE_STATE index 0..18. idx 8 repeats
// idx 2 (primeVramFillAndAdvanceStep); idx 17 repeats idx 11 (tickSequenceDwellTimer).
const SEQUENCE_HANDLERS = [
  initSequenceEnableStarfield, // 0
  armStepCountdownAndTickSequenceTimer, // 1
  primeVramFillAndAdvanceStep, // 2
  fillVramRowThenResetObjectState, // 3
  emitMessageColumnsThenAdvanceSequence, // 4
  activateDescriptorSlotsThenAdvanceSequence, // 5
  queueColumnDrawAndAdvanceSequence, // 6
  dwellThenAdvanceSequence, // 7
  primeVramFillAndAdvanceStep, // 8 (dup of idx 2)
  blankVramRowThenResetSpriteState, // 9
  postCreditAndMessageDrawsAndAdvance, // 10
  tickSequenceDwellTimer, // 11
  clearFlagBlockAndReseedObjectShadow, // 12
  loadDescriptorAndAdvanceSequence, // 13
  activateObjectsAndBeginPlayPhase, // 14
  runGameplayFrameAndAdvanceOnFieldClear, // 15
  stepPlaySubstate6, // 16
  tickSequenceDwellTimer, // 17 (dup of idx 11)
  enterSequenceStep1, // 18
];

export function loc_0156(m) {
  advanceFormationSweepOscillator(m);
  summarizeFormationOccupancy(m);

  const state = m.mem8[SEQUENCE_STATE];
  const handler = SEQUENCE_HANDLERS[state];
  // Indices 0..18 are the real sub-state handlers; index 19 (a cold-reset sentinel) and any higher index
  // are unreachable for a valid SEQUENCE_STATE, so guard the invariant loudly instead of soft-resetting.
  if (!handler) {
    throw new Error(`loc_0156: SEQUENCE_STATE ${state} has no sub-state handler (0..18 expected; 19 is the cold-reset sentinel)`);
  }
  handler(m);

  return advanceGameStateOnCredit(m);
}
