// SPDX-License-Identifier: GPL-3.0-only
import { INTRO_PHASE_INDEX } from "./names.js";
import { seatIntroLaunchScriptAndAdvancePhase } from "./seatIntroLaunchScriptAndAdvancePhase.js";
import { runLevelIntroPhase1Frame } from "./runLevelIntroPhase1Frame.js";
import { advanceIntroPhaseAndDrawHitTally } from "./advanceIntroPhaseAndDrawHitTally.js";
import { advanceLevelIntroFromPhase3 } from "./advanceLevelIntroFromPhase3.js";
import { scaleTargetCountAndAdvanceIntroPhase4 } from "./scaleTargetCountAndAdvanceIntroPhase4.js";
import { advanceLevelIntroFromPhase5 } from "./advanceLevelIntroFromPhase5.js";
import { seatPlayReadyOnIntroDelayExpiry } from "./seatPlayReadyOnIntroDelayExpiry.js";

/**
 * dispatchLevelIntroPhase — the level-intro / round-start phase dispatcher.
 *
 * WHAT IT IS
 * The small selector that runs whenever the machine is in its level-intro state — the
 * short scripted sequence the game plays between rounds, before the player takes control:
 * it seats the object-launch/dive script for the coming round, animates the round's
 * opening, draws the running target-hit tally, scales the target-group count for the new
 * difficulty, and finally hands control to active play. That whole sequence is a small
 * state machine of seven phases; this routine is the step that picks which phase runs on
 * the current frame.
 *
 * ROLE IN THE MACHINE
 * The intro sequence is entered from the board-build sub-state machine (the round-parity
 * gate delegates here when the current round is an intro round rather than a plain
 * main-loop round). Each frame, this dispatcher reads the intro-phase selector and runs
 * exactly one phase handler. The seven handlers each do their per-frame work and, when
 * their phase is finished, bump the selector so the next frame lands on the next phase —
 * so the sequence advances itself, one phase at a time, without this dispatcher ever
 * deciding the order. The handler runs as the tail of this call: its return goes straight
 * back to this dispatcher's own caller, so the intro sequence costs one frame's work per
 * frame and nothing more.
 *
 * The seven phases, in order:
 *   0 seatIntroLaunchScriptAndAdvancePhase — run the shared sound pass, choose the round's
 *        object-launch/dive script (indexed by round number), seat it, prime the intro
 *        delay timer, and step to phase 1.
 *   1 runLevelIntroPhase1Frame — the per-frame body of the opening animation (nine
 *        sub-passes in fixed order).
 *   2 advanceIntroPhaseAndDrawHitTally — step the phase and paint the target-hit tally as
 *        two stacked digit pairs.
 *   3 advanceLevelIntroFromPhase3 — a timing gate that holds, then advances the phase.
 *   4 scaleTargetCountAndAdvanceIntroPhase4 — latch and scale the target-group count for
 *        the new round's difficulty, advance the phase, and re-prime the delay.
 *   5 advanceLevelIntroFromPhase5 — tick the target group, count the intro delay down to
 *        advance the phase, and toggle a display command every 16th frame.
 *   6 seatPlayReadyOnIntroDelayExpiry — the final hold: count the delay down and, on
 *        expiry, silence sound, clear the hit tally, and mark the play sub-state ready so
 *        the machine leaves the intro and enters active play.
 *
 * ROM: 0x6da6 (dispatch table inline at 0x6daa: phases 0..6 -> handlers at
 *      0x6db8 0x6e59 0x6f42 0x6f5e 0x6f9d 0x7032 0x705f).
 * Grounding: [seen].
 * LIVE-OUT: none — a void per-frame dispatch. The selected handler mutates state; this
 *      routine itself leaves nothing behind.
 */
export function dispatchLevelIntroPhase(m) {
  // Read the intro-phase selector INTRO_PHASE_INDEX (0x8f51) and branch on it. This is the
  // single byte that tracks how far the intro sequence has progressed; it holds a value
  // 0..6 and is bumped by whichever handler finishes its phase, so successive frames walk
  // through the phases in order. In the ROM this is a jump through the inline 7-word table
  // at 0x6daa; here each table slot is one switch case running that phase's handler. There
  // is no default — a selector outside 0..6 never occurs while the intro machine runs, so
  // an unrecognised value simply falls through and does nothing this frame.
  switch (m.mem8[INTRO_PHASE_INDEX]) {
    // Phase 0 — seat the round's launch/dive script and prime the delay, then step to phase 1.
    case 0: return seatIntroLaunchScriptAndAdvancePhase(m);
    // Phase 1 — the opening animation's per-frame body (nine sub-passes in fixed order).
    case 1: return runLevelIntroPhase1Frame(m);
    // Phase 2 — advance the phase and draw the target-hit tally (two stacked digit pairs).
    case 2: return advanceIntroPhaseAndDrawHitTally(m);
    // Phase 3 — a timing gate that holds for a beat, then advances the phase.
    case 3: return advanceLevelIntroFromPhase3(m);
    // Phase 4 — latch/scale the target-group count for the new round, advance, re-prime the delay.
    case 4: return scaleTargetCountAndAdvanceIntroPhase4(m);
    // Phase 5 — tick the target group, count the delay down to advance, toggle a display command every 16th frame.
    case 5: return advanceLevelIntroFromPhase5(m);
    // Phase 6 (final) — count the delay down; on expiry silence sound, clear the tally, mark play ready.
    case 6: return seatPlayReadyOnIntroDelayExpiry(m);
  }
}
