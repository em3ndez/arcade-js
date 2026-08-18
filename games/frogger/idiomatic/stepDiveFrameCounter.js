// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepDiveFrameCounter  —  ROM 0x28b0  ·  grounding: [code] (MAME-grounding pending)
 *
 * WHAT IT IS
 *   One tick of the diver's pacing countdown. The two-pair "diver" figure that drifts across the river
 *   is paced by a two-cell timer: TWOPLAYER_FRAME_CELL_8146 (0x8146) holds the reload PERIOD, and its
 *   sibling TWOPLAYER_FRAME_CELL_8147 (0x8147) is the live COUNTDOWN. This routine advances one such
 *   countdown cell by a single step: while it still has ticks left it just decrements; the instant it
 *   hits zero it reloads to a full period from the seed cell so the countdown repeats. That is the whole
 *   job — a saw-tooth counter that free-runs between the period and zero.
 *
 * WHERE IT SITS
 *   Called by the shared dive pacer stepDiveSurfaceTimer (ROM 0x27fe) once per in-play frame while a
 *   dive cycle is armed. On the frames where the countdown has not yet caught up to the period
 *   (0x8147 != 0x8146) the pacer emits NO dive frame and simply asks this routine to burn one tick —
 *   that is the delay between visible dive frames. So this counter is the metronome; the larger the
 *   seeded period ((ANIM_FRAME_BUFFER 0x819b & 0x0f) * 8), the slower the diver animates.
 *
 * LIVE-IN
 *   The cell to step is the HL live-in (m.regs.hl). In practice the pacer always hands in 0x8147, the
 *   live countdown cell; the routine itself is address-agnostic and would step whatever cell HL names.
 *
 * LIVE-OUT
 *   Memory only. It writes the one counter cell it was handed (either decremented or reloaded), returns
 *   nothing, and leaves no register the caller reads.
 */
import { TWOPLAYER_FRAME_CELL_8146 } from "./names.js";

export function stepDiveFrameCounter(m, counter = m.regs.hl) {
  const { mem8 } = m;

  // ── Drained? → reload a full period ──────────────────────────────────────────────────
  // When the countdown cell has reached 0 it has finished one interval. Reload it to a fresh period by
  // copying the seed cell TWOPLAYER_FRAME_CELL_8146 (0x8146) — the value both counter cells were armed
  // to at the start of the dive cycle. This is what makes the timer repeat rather than stop at zero.
  if (mem8[counter] === 0) {
    mem8[counter] = mem8[TWOPLAYER_FRAME_CELL_8146];
    return;
  }

  // ── Otherwise → burn one tick ────────────────────────────────────────────────────────
  // Still mid-interval: count down by one (the ROM's DEC on the counter cell). No dive frame is emitted
  // on these plain-tick frames; they are purely the inter-frame delay.
  mem8[counter] = mem8[counter] - 1;
}
