// SPDX-License-Identifier: GPL-3.0-only
/**
 * resetDiveSurfaceCounter  —  ROM 0x288c  ·  grounding: [code]
 *
 * WHAT IT IS
 *   The MID-BAND (levels 2..4) one-shot arm for the river diver's "dive" animation — the descending
 *   tile column the diver paints as it submerges. Once per dive cycle it seeds the surface-timer that
 *   paces those frames, steps the animation-variant gate, then latches itself off so the rest of the
 *   cycle runs without re-seeding.
 *
 * WHERE IT SITS
 *   Called from the per-frame dive driver loc_27ea (0x27ea) on levels 2..4 only, and only on the frame
 *   the figure is idle (FIGURE_ANIM_PHASE 0x8101 == 0) — i.e. the moment a fresh dive begins — just
 *   before the shared surface-timer step stepDiveSurfaceTimer (0x27fe). It is the structural twin of the
 *   level>=5 arm armTwoPairFigureFrame (0x287e); the ONLY difference is that this one INCREMENTS the step
 *   gate where the high arm SETS it to 1 (see the gate step below).
 *
 * LIVE-OUT
 *   Memory only. It writes the step gate, both surface-timer cells, and the busy latch. It returns
 *   nothing and leaves no register the caller reads. If a dive cycle is already armed (busy latch set) it
 *   returns having touched nothing.
 */
import {
  SPRITE_FRAME_BUSY_LATCH1,
  FIGURE_ANIM_STEP_GATE,
  ANIM_FRAME_BUFFER,
  TWOPLAYER_FRAME_CELL_8146,
  TWOPLAYER_FRAME_CELL_8147,
} from "./names.js";

// The dive's pacing seed is (ANIM_FRAME_BUFFER & 0x0f) * 8: the low nibble of the shared frame buffer is
// a value 0..15, scaled by 8 into a countdown period of 0..120 ticks. A larger nibble means a slower dive
// (more ticks between emitted frames). These two constants spell out that "& 0x0f, then * 8" seed.
const LOW_NIBBLE = 0x0f; // isolate the low four bits of ANIM_FRAME_BUFFER
const SEED_SCALE = 8; // scale that nibble into the surface-timer period

export function resetDiveSurfaceCounter(m) {
  const { mem8 } = m;

  // ── Busy-latch guard: arm at most once per cycle ─────────────────────────────────────
  // SPRITE_FRAME_BUSY_LATCH1 (0x814f) is the interlock shared with the figure animator and the dive
  // copier. Non-zero means "a dive cycle is already armed and running", so we bail without touching
  // anything — a later pass this same cycle must not re-seed the timer. The copier (copyDiveAnimFrame
  // 0x281b) clears this latch when the cycle finishes, which re-enables both the figure animation and the
  // next arm.
  if (mem8[SPRITE_FRAME_BUSY_LATCH1] !== 0) return; // already armed this cycle -> leave state untouched

  // ── Step the arm / variant gate ──────────────────────────────────────────────────────
  // FIGURE_ANIM_STEP_GATE (0x8150). Bit 0 must be set for the figure animation and the frog-vs-diver
  // collision test to step, and the surface-timer pacer reads bit 0 to choose which ROM tile table the
  // dive copier is handed. This mid-band arm INCREMENTS the gate (the high arm 0x287e SETS it to 1);
  // incrementing flips bit 0 between successive dive cycles, so on levels 2..4 the copier alternates its
  // tile-table variant from one cycle to the next.
  mem8[FIGURE_ANIM_STEP_GATE] = mem8[FIGURE_ANIM_STEP_GATE] + 1;

  // ── Compute the surface-timer seed ───────────────────────────────────────────────────
  // ANIM_FRAME_BUFFER (0x819b) is the shared animation frame buffer, filled elsewhere with the current
  // frame source. Its low nibble times 8 is the countdown period for the dive pacer — the inter-frame
  // delay of the descending column.
  const seed = (mem8[ANIM_FRAME_BUFFER] & LOW_NIBBLE) * SEED_SCALE;

  // ── Seed BOTH surface-timer cells to the same value ──────────────────────────────────
  // The pair is TWOPLAYER_FRAME_CELL_8146 (0x8146, the reload period) and TWOPLAYER_FRAME_CELL_8147
  // (0x8147, the live countdown). Writing both to the same value leaves period == countdown, which is
  // exactly the "just reloaded" state the pacer stepDiveSurfaceTimer (0x27fe) treats as ready: on the
  // next tick it consumes one count and emits the first dive frame.
  mem8[TWOPLAYER_FRAME_CELL_8146] = seed;
  mem8[TWOPLAYER_FRAME_CELL_8147] = seed;

  // ── Raise the busy latch ─────────────────────────────────────────────────────────────
  // Mark the cycle as armed so the guard above short-circuits every later pass until the copier clears
  // the latch at cycle end. This is the final write; the routine returns memory-only.
  mem8[SPRITE_FRAME_BUSY_LATCH1] = 1;
}
