// SPDX-License-Identifier: GPL-3.0-only
/**
 * runAttractSequenceAndAdvanceOnCredit — the game-state-1 (attract/demo) handler.
 *
 * WHAT IT IS
 *   The top-level handler for game-state 1, the attract loop that runs the title, starfield, scrolling
 *   message columns and a canned demo. Each frame it runs the shared formation prep (sweep oscillator +
 *   occupancy summary), dispatches on the sequence-state selector SEQUENCE_STATE (0x400a) to the current
 *   attract sub-state handler, then finishes at the post-dispatch continuation advanceGameStateOnCredit.
 *
 * ROLE IN THE MACHINE
 *   ROM 0x0156. The idiomatic form ABSORBS the ROM's rst-28 computed jump into the SEQUENCE_HANDLERS table
 *   below, calling the named handler for each state index directly, so the push + rst-28 and its inline word
 *   table dissolve. That word table has 20 entries; indices 0..18 are real handlers (two duplicated: idx 8
 *   == idx 2, idx 17 == idx 11), and index 19's word is a cold-reset terminator sentinel, not a real
 *   handler. SEQUENCE_STATE only ever holds 0..18 in valid play, so index 19 (whose table word would soft-
 *   reset) and any higher index are unreachable; both are guarded as a hard error rather than reproduced,
 *   keeping the invariant loud and the module self-contained. The tail continuation leaves attract for the
 *   press-start screen (game-state 2) once a credit is present.
 *
 *   Grounding: [seen].
 *
 * LIVE-OUT: memory/VRAM/hardware only (whatever the selected sub-handler and the continuation touch); no
 * register result the caller reads.
 */
// Per-frame formation prep, run before the dispatch (formation sweep oscillator + row/column occupancy).
import { advanceFormationSweepOscillator } from "./advanceFormationSweepOscillator.js";
import { summarizeFormationOccupancy } from "./summarizeFormationOccupancy.js";
// Post-dispatch continuation (the ROM's pushed return): once credit count 0x4002 is nonzero, advance
// GAME_STATE and reset the attract sub-state cluster; zero credits leave attract running.
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

// The absorbed rst-28 word table: one handler per SEQUENCE_STATE index 0..18. idx 8 repeats idx 2
// (primeVramFillAndAdvanceStep); idx 17 repeats idx 11 (tickSequenceDwellTimer). Each full-line note states
// what that attract sub-state does.
const SEQUENCE_HANDLERS = [
  // 0: sequence init — enqueue setup command words, enable the starfield (STARS_ENABLE 0x7004), reset the
  //    per-sequence cells, seed the dwell cascade, and advance.
  initSequenceEnableStarfield, // 0
  // 1: arm countdown cell 0x4019=1, then tick the prescaled sequence timer.
  armStepCountdownAndTickSequenceTimer, // 1
  // 2: VRAM-fill setup — clear the 0x4100 flag block + status bytes, seed the VRAM fill cursor, arm the
  //    0x4009 dwell to 32, and advance.
  primeVramFillAndAdvanceStep, // 2
  // 3: fill a 28-cell strip of tile 16 and advance the cursor +32 per frame; on dwell expiry advance, re-arm
  //    the dwell cascade, clear the OBJ_ACTIVE_FLAG block, and reseed the object shadow.
  fillVramRowThenResetObjectState, // 3
  // 4: clear the strided table, then a two-tier dwell that enqueues channel-6 message-column draws; on the
  //    mid-tier expiry advance and reload both tiers.
  emitMessageColumnsThenAdvanceSequence, // 4
  // 5: run the 4 shared subsystem updates; on the sub-timer expiry activate a descriptor slot and bump
  //    DRAWN_COLUMN_COUNT, on the dwell expiry advance.
  activateDescriptorSlotsThenAdvanceSequence, // 5
  // 6: run the 4 shared subsystem updates, count down the dwell; on expiry advance, re-arm the timer pair,
  //    bump DRAWN_COLUMN_COUNT, and enqueue a channel-6 column-draw command.
  queueColumnDrawAndAdvanceSequence, // 6
  // 7: a pure dwell state — run the 4 shared subsystem updates and tick the prescaled dwell, no staging of
  //    its own.
  dwellThenAdvanceSequence, // 7
  primeVramFillAndAdvanceStep, // 8 (dup of idx 2)
  // 9: clear the strided table and blank a row; on dwell expiry advance, clear the sprite source/shadow,
  //    reseed the object shadow, and queue command word 6.
  blankVramRowThenResetSpriteState, // 9
  // 10: enqueue a channel-7 credit-count redraw and a channel-6 message-column draw, advance, and re-arm the
  //     two dwell tiers.
  postCreditAndMessageDrawsAndAdvance, // 10
  // 11: tick the shared cascade dwell countdown, advancing SEQUENCE_STATE on the tier's expiry.
  tickSequenceDwellTimer, // 11
  // 12: zero-fill the 128-byte flag block, clear the status cells, arm the dwell, then advance and reseed the
  //     stride-2 object shadow.
  clearFlagBlockAndReseedObjectShadow, // 12
  // 13: unpack a packed descriptor bitmask into the flag block, copy the trailing 8-byte template into
  //     0x4218, set the state cells, increment the sequence, and publish the sub-state pointer.
  loadDescriptorAndAdvanceSequence, // 13
  // 14: begin play — on dwell expiry set OBJ_ACTIVE_FLAG (0x4200)=1 to enable the object/AI/projectile
  //     subsystem and seed the play cells (the attract demo runs a real game).
  activateObjectsAndBeginPlayPhase, // 14
  // 15: the per-frame gameplay pipeline itself (the demo "plays" through it).
  runGameplayFrameAndAdvanceOnFieldClear, // 15
  // 16: the sub-state-6 step — advance or redirect the sequence and reload the dwell.
  stepPlaySubstate6, // 16
  tickSequenceDwellTimer, // 17 (dup of idx 11)
  // 18: set SEQUENCE_STATE=1 and arm the step-1 dwell cascade (a restart of the attract cycle).
  enterSequenceStep1, // 18
];

export function runAttractSequenceAndAdvanceOnCredit(m) {
  // Shared per-frame formation prep, run for every sub-state.
  advanceFormationSweepOscillator(m);
  summarizeFormationOccupancy(m);

  // Dispatch on the current sequence step to the matching attract sub-handler.
  const state = m.mem8[SEQUENCE_STATE];
  const handler = SEQUENCE_HANDLERS[state];
  // Indices 0..18 are the real sub-state handlers; index 19 (a cold-reset sentinel) and any higher index
  // are unreachable for a valid SEQUENCE_STATE, so guard the invariant loudly instead of soft-resetting.
  if (!handler) {
    throw new Error(`runAttractSequenceAndAdvanceOnCredit: SEQUENCE_STATE ${state} has no sub-state handler (0..18 expected; 19 is the cold-reset sentinel)`);
  }
  handler(m);

  // Post-dispatch continuation: leave attract for the press-start screen once a credit is present.
  return advanceGameStateOnCredit(m);
}
