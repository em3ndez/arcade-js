// SPDX-License-Identifier: GPL-3.0-only
import { rearmMainLoopFrame } from "./rearmMainLoopFrame.js";
import { runActivePlayFrame } from "./runActivePlayFrame.js";
import { queueBonusStageTallyDisplayOnDelay } from "./queueBonusStageTallyDisplayOnDelay.js";
import { paintSubstateHudDigitsAndAdvancePhase } from "./paintSubstateHudDigitsAndAdvancePhase.js";
import { driveHunterSpawnDisplayAndAdvancePhase } from "./driveHunterSpawnDisplayAndAdvancePhase.js";
import { advancePlayStateToPhase6OnDwellExpiry } from "./advancePlayStateToPhase6OnDwellExpiry.js";
import { advanceObjectsAndRebuildSprites } from "./advanceObjectsAndRebuildSprites.js";
import { MAINLOOP_SUBSTATE_SELECTOR } from "./names.js";

/**
 * dispatchMainLoopSubstate — the main-loop sub-state dispatcher.
 *
 * WHAT IT IS
 *   A six-way fan-out that runs exactly one of six per-frame handlers, chosen by the low three
 *   bits of the main-loop sub-state selector MAINLOOP_SUBSTATE_SELECTOR (0x8f5c). The selector is
 *   a phase index the handlers themselves bump (adjustCounterAndPaintBcdHudFields advances it), so
 *   the machine walks 0 -> 1 -> 2 -> ... through these phases across successive frames.
 *
 * ROLE IN THE MACHINE
 *   This is the innermost of the game's three nested per-frame dispatch levels. The outer level
 *   selects on the master game state (0x8805); when the game is in play that hands off to the
 *   in-play sub-state index (0x880a); and one of those in-play handlers
 *   (dispatchLevelIntroElseMainLoop), when the round counter's bit 1 is clear, delegates here to
 *   turn the main-loop phase selector into concrete work for the frame. In short: this is the
 *   phase engine that sequences the between-play book-keeping (HUD repaints, bonus-stage tally,
 *   hunter-spawn display, dwell timers) and the active-play frame itself.
 *
 * ROM 0x0fd5-0x0fe2 (dispatcher body); the six-entry jump table it reads lives inline at 0x0fe3.
 * Grounding: [seen]
 *
 * STRUCTURE
 *   Selector values 0 and 1 hand off to their handler and return through it directly. Selector
 *   values 2..5 run the selected handler and then always run the shared post-handler tail
 *   advanceObjectsAndRebuildSprites (ROM 0x1035) — the four trailing per-frame passes (target-actor
 *   step, per-object sweep, formation-state dispatch, sprite display-list rebuild) that every one
 *   of those four phases needs after its own work. So states 2..5 share a common frame epilogue
 *   that states 0/1 (which run their own full frame) do not.
 *
 *   The selector is masked to 3 bits (& 7), so it can in principle take the values 6 and 7; those
 *   two fall past the six-entry table and trip the guard below. In the running game the selector
 *   only ever holds 0..5, so 6/7 are dead guard-slack.
 *
 * LIVE-OUT: memory only — the selected handler's effects (and, for states 2..5, the shared tail's).
 * No register is read on entry and none is produced on return.
 */
export function dispatchMainLoopSubstate(m) {
  // Read the phase selector at 0x8f5c and keep only its low 3 bits: this is the sub-state index.
  switch (m.mem8[MAINLOOP_SUBSTATE_SELECTOR] & 7) {
    // State 0 — re-arm the frame: reload STAGE_COUNTDOWN, run the integrity walker when
    // ROUND_COUNTER bit 2 is set, re-arm the three per-frame latches and the sound enqueue, then
    // latch the pending sub-state and run the worker chain (idle on zero). Returns to the caller.
    case 0: return rearmMainLoopFrame(m);
    // State 1 — the active-play frame: run one frame's ten subsystem updates in fixed order (HUD,
    // lead-actor input, sub-state advance, object-update gate, enemy spawns, enemy-record state
    // sweep, formation dispatch, sprite display-list rebuild, actor pipeline, sound-ring drain).
    // Returns to the caller; it does its own rebuilds and does not want the shared tail.
    case 1: return runActivePlayFrame(m);
    // State 2 — bonus-stage tally, delayed: tick the field-1 frame-delay counter down while it is
    // non-zero; on expiry bump the selector (0x8f5c) to advance the phase and enqueue the
    // bonus-stage tally display command. Then run the shared post-handler tail (0x1035).
    case 2: queueBonusStageTallyDisplayOnDelay(m); return advanceObjectsAndRebuildSprites(m);
    // State 3 — repaint the three sub-state HUD BCD digit fields (field-1 value plus its
    // re-centred second draw, field-2 value, the field-3 fold/double/hundreds-latch), then bump the
    // phase selector (0x8f5c) and queue the phase sound. Then run the shared tail (0x1035).
    case 3: paintSubstateHudDigitsAndAdvancePhase(m); return advanceObjectsAndRebuildSprites(m);
    // State 4 — drive the hunter-spawn display: tick the field-1 timer, enqueueing the
    // hunter-spawn display command while it counts; on expiry reload it to 0x80 and advance the
    // selector (0x8f5c). Then run the shared post-handler tail (0x1035).
    case 4: driveHunterSpawnDisplayAndAdvancePhase(m); return advanceObjectsAndRebuildSprites(m);
    // State 5 — advance the play state once the dwell timer expires: tick the countdown timer
    // (decrement and return while it is non-zero); on expiry clear the 9-byte block from
    // LATCHED_ENEMY_X, enqueue the silence sound command, set PLAY_STATE_INDEX to 6, then run the
    // object-slot spawn sweep unless SCORE_DRIP_ACCUM plus the tamper guard sum to zero. Then run
    // the shared post-handler tail (0x1035).
    case 5: advancePlayStateToPhase6OnDwellExpiry(m); return advanceObjectsAndRebuildSprites(m);
    // Selector 6 or 7 — past the six-entry table at 0x0fe3. Unreachable in the running machine
    // (the selector only ever holds 0..5); trip a guard rather than jump through a bogus slot.
    default:
      throw new Error("dispatchMainLoopSubstate: main-loop sub-state selector > 5 (guard-slack)");
  }
}
