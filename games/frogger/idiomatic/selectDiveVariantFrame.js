// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectDiveVariantFrame  —  ROM 0x286d  ·  grounding: [code] (MAME-grounding pending)
 *
 * WHAT IT IS
 *   The even-phase entry point to the river diver's *dive* animation blitter. The dive animation paints
 *   its tile column from one of two ROM frame tables, chosen by a gate bit that alternates from one dive
 *   cycle to the next. This tiny routine IS the "even" choice: it points the copier at the ALTERNATE
 *   (arm-0) tile table FROG_ANIM_ARM0_SRC_BASE (0x1403) and hands the actual blit to the shared copier.
 *   Its only job is table selection — it emits nothing itself.
 *
 * WHERE IT SITS
 *   The per-frame dive pacer stepDiveSurfaceTimer (0x27fe) counts a period down and, once per period,
 *   emits exactly one dive frame. Which table that frame is copied from depends on bit 0 of the arm/
 *   variant gate FIGURE_ANIM_STEP_GATE (0x8150):
 *     · EVEN phase (bit0 == 0) → the pacer calls THIS routine, which selects FROG_ANIM_ARM0_SRC_BASE
 *       (0x1403) and forwards to copyDiveAnimFrame (0x281b).
 *     · ODD phase (bit0 == 1) → the pacer calls copyDiveAnimFrame directly with the main tile-pair
 *       table FROG_ANIM_TILE_PAIR_SRC (0x1413).
 *   The gate bit flips between cycles only in the mid-level band, where the arm routine INCREMENTS the
 *   gate each cycle; the high-level arm pins it to 1, so the alternate table is a mid-band phenomenon.
 *   (0x1403 is the same ROM tile base the frog-animation render arm 0, renderFrogAnimArm0, blits from —
 *   the dive's even variant simply reuses it as its alternate frame source.)
 *
 * LIVE-OUT
 *   None of its own. It is a pure tail-call: everything observable (two VRAM cells written, two cursor
 *   cells advanced, and — on the eighth/final frame — the busy-latch release plus dive-state teardown)
 *   happens inside copyDiveAnimFrame. It returns whatever the copier returns, which is nothing.
 */
import { copyDiveAnimFrame } from "./copyDiveAnimFrame.js";
import { FROG_ANIM_ARM0_SRC_BASE } from "./names.js";

export function selectDiveVariantFrame(m) {
  // ── Select the alternate table and hand off the blit ─────────────────────────────────
  // copyDiveAnimFrame takes the ROM frame-table base as its second argument (the live-in that arrived in
  // register HL in the translated form). The even-phase variant supplies the arm-0 tile table
  // FROG_ANIM_ARM0_SRC_BASE (0x1403) — as opposed to the main FROG_ANIM_TILE_PAIR_SRC (0x1413) the odd
  // phase uses — so this dive cycle paints from the alternate tile set. In the ROM the hand-off is a
  // straight `jp copyDiveAnimFrame`, so we tail-call it and return its (empty) result unchanged.
  return copyDiveAnimFrame(m, FROG_ANIM_ARM0_SRC_BASE);
}
