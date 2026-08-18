// SPDX-License-Identifier: GPL-3.0-only
/**
 * armTwoPairFigureFrame  —  ROM 0x287e  ·  grounding: [seen,poked]
 *
 * WHAT IT IS
 *   The one-shot "arm" that starts a fresh dive cycle for the river's two-pair diver figure, in the
 *   high-difficulty band (level >= 5). That figure drives two VRAM animations off ONE shared block of
 *   arm/gate/latch state; before either animation can play, the block has to be seeded exactly once at the
 *   top of a cycle. This routine performs that seeding: it opens the step gate that the figure animator
 *   and the frog-vs-diver collision test both read, primes the surface-timer countdown that paces the
 *   descending dive column, and then latches itself shut so the same cycle cannot re-seed on a later frame.
 *
 * WHERE IT SITS
 *   Called from the high-phase dive arm armDiveHighPhase (ROM 0x2874), and only while the figure is idle
 *   (FIGURE_ANIM_PHASE 0x8101 == 0) — i.e. at the very start of a dive. armDiveHighPhase is itself the
 *   level>=5 branch of the per-frame dive driver, so this only fires on the harder levels. It is the
 *   structural twin of the mid-band arm resetDiveSurfaceCounter (ROM 0x288c); the single behavioural
 *   difference is that this HIGH arm *sets* the step gate to 1 (pinning bit0 on, always the main tile
 *   variant), whereas the MID arm *increments* it (flipping bit0 between cycles to alternate the table).
 *
 * LIVE-OUT
 *   Memory only. It writes the step gate, the two surface-timer cells and the busy latch, returns nothing,
 *   and leaves no register the caller reads — the sole caller reloads everything from memory. On the vast
 *   majority of frames it no-ops at the busy-latch guard below without touching a single cell.
 */
import { SPRITE_FRAME_BUSY_LATCH1, FIGURE_ANIM_STEP_GATE, ANIM_FRAME_BUFFER, TWOPLAYER_FRAME_CELL_8146, TWOPLAYER_FRAME_CELL_8147 } from "./names.js";

// The surface-timer seed is taken from the LOW NIBBLE (bits 0-3) of the shared animation frame buffer.
const LOW_NIBBLE = 0x0f;

// ...then scaled by 8. The product (0x00..0x78) becomes the countdown PERIOD: the dive pacer emits one
// dive frame per full countdown, so a larger low nibble here means a longer period and a slower descent.
const SEED_SCALE = 8;

export function armTwoPairFigureFrame(m) {
  const { mem8 } = m;

  // ── Guard: has this dive cycle already been seeded? ──────────────────────────────────────
  // SPRITE_FRAME_BUSY_LATCH1 (0x814f) is the mutual interlock shared by the figure animator and the dive
  // copier. It reads 0 only when no dive cycle is armed (idle). This routine RAISES it as its final act
  // (see seedFrameCells), so on every later frame of the same cycle the latch is found set and we bail
  // here without re-seeding. The copier clears the latch when its eight-frame cycle completes, which is
  // what lets a fresh arm run again.
  if (mem8[SPRITE_FRAME_BUSY_LATCH1] !== 0) return; // busy latch already set -> already seeded this cycle

  // ── Open the step gate ───────────────────────────────────────────────────────────────────
  // FIGURE_ANIM_STEP_GATE (0x8150) bit0 must be set for BOTH the figure animator animateTwoPairFigure
  // (0x291d) and the collision test mountOrKillFrogOnTwoPairFigure (0x28bb) to step. The high arm writes
  // exactly 1 here (pinning bit0 on → the main/odd tile variant); the mid-band twin increments instead,
  // which is the only functional divergence between the two arms.
  mem8[FIGURE_ANIM_STEP_GATE] = 1;

  // ── Seed the surface-timer and latch the cycle shut ──────────────────────────────────────
  seedFrameCells(m);
}

// Seed the surface-timer counter pair from the frame buffer's low nibble, then raise the busy latch. This
// is the shared "seed block" — structurally the same three writes the mid-band arm resetDiveSurfaceCounter
// (0x288c) performs after it bumps the gate.
function seedFrameCells(m) {
  const { mem8 } = m;

  // The pacing seed: low nibble of the shared frame buffer ANIM_FRAME_BUFFER (0x819b), scaled by 8. That
  // buffer is filled elsewhere (the frame-cell animation source); only its low nibble matters to the dive.
  const seed = (mem8[ANIM_FRAME_BUFFER] & LOW_NIBBLE) * SEED_SCALE;

  // Write the SAME value into both surface-timer cells. In the pacer stepDiveSurfaceTimer (0x27fe) these
  // two act as a period/countdown pair: TWOPLAYER_FRAME_CELL_8146 (0x8146) is the reload period and
  // TWOPLAYER_FRAME_CELL_8147 (0x8147) is the live countdown. Seeding them equal starts the pair matched,
  // which the pacer reads as "emit a dive frame now" on its very first tick.
  mem8[TWOPLAYER_FRAME_CELL_8146] = seed;
  mem8[TWOPLAYER_FRAME_CELL_8147] = seed;

  // Latch the cycle shut. With SPRITE_FRAME_BUSY_LATCH1 (0x814f) now non-zero, the guard in the caller
  // rejects any re-seed on later frames, and the figure animator bails on its own busy-latch check
  // (the interlock) so only the dive copier advances until the copier clears this latch at cycle end.
  mem8[SPRITE_FRAME_BUSY_LATCH1] = 1;
}
