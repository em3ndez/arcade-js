// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_27ea  —  ROM 0x27EA  ·  grounding: [seen,poked]
 *
 * WHAT IT IS
 *   The per-frame DRIVER for the river's two-pair diver animation — the rideable/lethal figure whose
 *   graphic is a 2x2 tile quad and whose "dive" paints a descending tile column as it submerges. This
 *   routine holds no animation logic of its own; it is a level-gated DISPATCHER that decides, once per
 *   in-play frame, which arm/pacer path the diver runs on the current level. Everything it does is a
 *   branch followed by a hand-off.
 *
 * WHERE IT SITS
 *   Run every in-play frame by the collision orchestrator orchestrateCollisionsAndFrogInput (0x1a55),
 *   which invokes the diver's routines in fixed order (collision test, figure animator, then this driver)
 *   only while the play flag PLAY_FLAG (0x83fe) is set. The orchestrator tails straight to its exit when
 *   that flag is clear, so this NEVER runs in attract mode — hence its grounding tag carries "poked": the
 *   equivalence test has to force the level/counter cells on a post-boot clone to exercise each arm.
 *
 *   The name is intentionally still `loc_` (see mechanisms.md "Not yet named / open"): the CELL it reads
 *   is settled (0x83b7 is the level/lives count) but whether this clock is turtle-dive-specific or a
 *   generic figure clock is undecided, so no descriptive name has converged.
 *
 * LIVE-OUT
 *   Memory only, and none of it written here directly — every side effect lives in the routines this one
 *   dispatches to (the arms seed the gate/timer/latch block; the pacer emits dive frames into VRAM). It
 *   returns nothing and leaves no register the caller reads.
 */
import { LIVES_COUNT, FIGURE_ANIM_PHASE } from "./names.js";
import { armDiveHighPhase } from "./armDiveHighPhase.js";
import { resetDiveSurfaceCounter } from "./resetDiveSurfaceCounter.js";
import { stepDiveSurfaceTimer } from "./stepDiveSurfaceTimer.js";

export function loc_27ea(m) {
  const { mem8 } = m;

  // ── Read the level, then dispatch on it ──────────────────────────────────────────────
  // LIVES_COUNT (0x83b7) is the game's level/lives count. Despite this subsystem's "dive phase" framing,
  // the ROM reads 0x83b7 here purely as the difficulty SELECTOR for the diver (it does not decrement on
  // frog deaths, and it is not a cycling animation phase — see mechanisms.md). It picks one of three
  // bands below.
  const level = mem8[LIVES_COUNT];

  // ── Band 1: below level 2 → no diver at all ──────────────────────────────────────────
  // The diver hazard first appears at level 2, so on level 1 there is nothing to arm or pace: return at
  // once, touching no memory. (The frozen oracle reaches this by way of an idle-arm stub at 0x2873 that
  // is itself a bare `ret`; dissolved here to a plain return, which is memory-equivalent.)
  if (level < 2) return;

  // ── Band 3: level 5+ → hand to the high-difficulty arm ───────────────────────────────
  // At level 5 and up the diver switches to the high band. armDiveHighPhase (0x2874) arms the cycle with
  // armTwoPairFigureFrame (which SETS the step gate to 1, pinning the main tile variant) and then runs the
  // shared pacer. Plain tail-call: its memory-only result is ours. (Guard ordering matters — this >= 5
  // test runs before the 2..4 body below, so the middle band is exactly levels 2, 3 and 4.)
  if (level >= 5) return armDiveHighPhase(m);

  // ── Band 2: the middle band (levels 2..4) ────────────────────────────────────────────
  // FIGURE_ANIM_PHASE (0x8101) reads 0 only while no diver figure is on screen — i.e. at the very top of a
  // dive, before anything is armed (on every later frame of a live cycle it is non-zero, doubling as the
  // diver's on-screen X). At that idle instant we fire the mid-band one-shot arm resetDiveSurfaceCounter
  // (0x288c): the twin of the high arm, except it INCREMENTS the step gate rather than setting it — so
  // bit 0 flips cycle-to-cycle and the copier alternates its ROM tile table on levels 2..4. The arm carries
  // its own busy-latch guard, so seeding happens at most once per cycle even though this branch can recur.
  if (mem8[FIGURE_ANIM_PHASE] === 0) {
    resetDiveSurfaceCounter(m);
  }

  // ── Middle band always paces the armed dive ──────────────────────────────────────────
  // Whether or not we just armed, fall into the shared per-frame pacer stepDiveSurfaceTimer (0x27fe): if a
  // dive cycle is armed (busy latch set) it runs the two-cell period/countdown timer and emits one
  // descending dive frame per full countdown; if the latch is clear it returns at once. This unconditional
  // tail-call is why the two idle/busy sub-cases of the middle band share one exit — arming is the only
  // thing FIGURE_ANIM_PHASE == 0 changes; the pace step runs identically on both. Plain tail-call.
  return stepDiveSurfaceTimer(m);
}
