// SPDX-License-Identifier: GPL-3.0-only
/**
 * armDiveHighPhase  —  ROM 0x2874  ·  grounding: [code] (MAME-grounding pending)
 *
 * WHAT IT IS
 *   The high-difficulty (level >= 5) "arm-then-pace" step for the river's two-pair diver figure — the
 *   rideable/lethal object whose graphic is a 2x2 tile quad. Once per in-play frame on level 5 and up it
 *   does two things in order: at the instant a dive cycle should begin (the figure is idle) it fires the
 *   one-shot arm that seeds the shared arm/gate/latch block, and then — always — it runs the shared
 *   per-frame pacer that advances whatever dive is currently armed. The routine itself is thin: it holds
 *   no logic of its own, it just chooses whether to arm and then hands off to the pacer.
 *
 * WHERE IT SITS
 *   This is the level>=5 branch of the per-frame dive driver loc_27ea (0x27ea), which dispatches on the
 *   level/difficulty count LIVES_COUNT (0x83b7): below level 2 there is no diver and it returns; on the
 *   middle band (levels 2..4) it arms via resetDiveSurfaceCounter (0x288c); on level 5+ it hands here. That
 *   driver is run every in-play frame by the collision orchestrator orchestrateCollisionsAndFrogInput
 *   (0x1a55) while the play flag PLAY_FLAG (0x83fe) is set, so none of this executes in attract mode.
 *   This routine is the near-twin of the middle-band path — the only difference is which arm it calls: the
 *   HIGH path arms via armTwoPairFigureFrame (0x287e), which SETS the step gate to exactly 1 (pinning the
 *   main tile variant), whereas the MID path's resetDiveSurfaceCounter INCREMENTS the gate (flipping the
 *   variant cycle-to-cycle). Both paths then fall into the same shared pacer.
 *
 * LIVE-OUT
 *   Memory only, and none of it written here directly: every side effect lives in the two routines this
 *   one calls. The arm seeds the step gate, the surface-timer counter pair and the busy latch; the pacer
 *   steps the countdown and, on an emit tick, blits one descending dive frame into VRAM. This routine
 *   returns nothing and leaves no register the caller reads.
 */
import { armTwoPairFigureFrame } from "./armTwoPairFigureFrame.js";
import { stepDiveSurfaceTimer } from "./stepDiveSurfaceTimer.js";
import { FIGURE_ANIM_PHASE } from "./names.js";

export function armDiveHighPhase(m) {
  // ── Start of a dive? Arm the cycle once ──────────────────────────────────────────────────
  // FIGURE_ANIM_PHASE (0x8101) reads 0 only while no diver figure is on screen — i.e. at the very top of a
  // dive, before anything is armed. (On every later frame of a live cycle this cell is non-zero: it doubles
  // as the diver's on-screen X coordinate, read by the collision test.) At that idle instant, fire the
  // one-shot high arm armTwoPairFigureFrame (0x287e) to seed the shared block: it opens the step gate the
  // figure animator and the frog-vs-diver collision test both read, primes the surface-timer countdown, and
  // raises the busy latch. The arm carries its own busy-latch guard, so it seeds exactly once per cycle even
  // though this branch can be reached on the first idle frame.
  if (m.mem8[FIGURE_ANIM_PHASE] === 0) {
    armTwoPairFigureFrame(m);
  }

  // ── Always pace the armed dive ───────────────────────────────────────────────────────────
  // Regardless of whether we just armed, fall into the shared per-frame pacer stepDiveSurfaceTimer (0x27fe).
  // If a dive cycle is armed (busy latch set) it runs the two-cell period/countdown timer and emits one
  // descending dive frame per full countdown; if the latch is clear (dive idle) it returns at once. In the
  // ROM armDiveHighPhase runs straight on into 0x27fe, so this is a plain tail-call — its (empty) result is
  // this routine's result.
  return stepDiveSurfaceTimer(m);
}
