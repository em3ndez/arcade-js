// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1cf2 — per-frame driver for Mario's DOWNWARD ladder climb.  ROM 0x1CF2.
 *
 * Paces the descent one animation sub-step at a time. Each frame Mario is climbing
 * down, this reads the shared move sub-step pacer (MARIO_MOVE_STEP_TIMER):
 *
 *   - while the pacer is still running (non-zero), it just knocks the pacer down by
 *     one and holds the current climb sub-step this frame;
 *   - the frame the pacer has reached 0, it reloads the pacer to the climb pace
 *     (3 frames) and advances ONE climb sub-step downward — a +2 nudge to Mario's
 *     height — through the shared climb stepper.
 *
 * So the descent advances one sub-step every few frames, its cadence set by the
 * reload value. This is the twin of the climb-UP driver (entry_1d03, ROM 0x1D03),
 * which feeds the same shared stepper a −2 step at the walk/climb reload; here the
 * fixed +2 step and the climb reload of 3 are what make it the DOWN direction.
 *
 * NAME: kept the neutral loc_ for the identifier. The mechanism is verified
 * climb-DOWN (the +2 step and the climb-pace reload of 3, corroborated by the shared
 * stepper advanceClimbStep, whose header already calls this caller the climb-down
 * twin), but promoting the routine name is a naming-pass job (proposer≠confirmer +
 * adversarial review); flagged for that pass — a fitting name is `stepClimbDown`.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1cf2.test.js.
 * GATE:     crafted-entry — 0x1CF2 is NOT reached in attract (the demo only climbs
 *           UP, never down), so entries are seeded from real 0x1D11 climb captures
 *           and steered by a surgical MARIO_MOVE_STEP_TIMER poke: an EXHAUSTIVE sweep
 *           of the pacer byte 0..255 (0 -> reload+step, else tick-down) plus crafted
 *           path-B arms that drive the shared stepper's center / both ladder-end /
 *           all three climb-frame outcomes. Teeth: inverted branch, wrong reload,
 *           wrong step.
 * LIVE-OUT: memory-only — MARIO_MOVE_STEP_TIMER here (tick-down or reload), plus
 *           whatever the tail callee writes. Its caller (the per-frame mover cascade)
 *           tails into this body and consumes no register it leaves.
 * NAMES:    MARIO_MOVE_STEP_TIMER (0x620F) — from ram.js. The reload value 3 (climb
 *           pace) and the +2 down step are plain constants. The cells the tail callees
 *           touch (MARIO_Y, the ladder limits, the centering-phase byte) are named
 *           inside those callees.
 */

import { MARIO_MOVE_STEP_TIMER } from "./ram.js";
import { tickMoveStepTimer } from "./tickMoveStepTimer.js"; // ROM 0x1D8A
import { advanceClimbStep } from "./advanceClimbStep.js";   // ROM 0x1D11

// The climb sub-step cadence: the pacer is reloaded to this once a sub-step advances.
const CLIMB_STEP_PACE = 3;
// Per-frame vertical nudge for a DOWN climb (increases Mario's height / moves him down).
const CLIMB_DOWN_STEP = 2;

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {void}
 */
export function loc_1cf2(m) {
  const { mem } = m;

  // Pacer still running: just tick it down and hold this frame's climb sub-step.
  if (mem.read8(MARIO_MOVE_STEP_TIMER) !== 0) {
    tickMoveStepTimer(m); // ROM 0x1D8A
    return;
  }

  // Pacer expired: reload it to the climb pace and advance one sub-step downward.
  mem.write8(MARIO_MOVE_STEP_TIMER, CLIMB_STEP_PACE);
  advanceClimbStep(m, CLIMB_DOWN_STEP); // ROM 0x1D11 — +2 step = climb down
}
