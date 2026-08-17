// SPDX-License-Identifier: GPL-3.0-only
/**
 * animateTwoPairFigure — advance the two-pair figure animation: idle-clears the phase, or when
 * armed steps it and blits a figure at phases 64 and 112 (the latter restarts it).
 * LIVE-OUT: memory-only.
 */
import { FIGURE_ANIM_PHASE, FIGURE_ANIM_STEP_GATE, SPRITE_FRAME_BUSY_LATCH1, TWO_PAIR_FIGURE_ANIM_PHASE, TWO_PAIR_FIGURE_VRAM } from "./names.js";

const FIGURE_STRIDE = 32; // second tile pair sits one row below the first
const PHASE_BLIT_A = 64;
const PHASE_BLIT_B = 112;
const FRAME_A_FIRST_TILE = 104;
const FRAME_B_FIRST_TILE = 208;

export function animateTwoPairFigure(m) {
  const { mem8 } = m;

  if (mem8[FIGURE_ANIM_PHASE] === 0) {
    mem8[TWO_PAIR_FIGURE_ANIM_PHASE] = 0;
    return;
  }
  if ((mem8[FIGURE_ANIM_STEP_GATE] & 1) === 0) return;
  if (mem8[SPRITE_FRAME_BUSY_LATCH1] !== 0) return;

  const phase = (mem8[TWO_PAIR_FIGURE_ANIM_PHASE] + 1) & 0xff;
  mem8[TWO_PAIR_FIGURE_ANIM_PHASE] = phase;
  if (phase === PHASE_BLIT_A) {
    blitFigure(FRAME_A_FIRST_TILE);
  } else if (phase === PHASE_BLIT_B) {
    blitFigure(FRAME_B_FIRST_TILE);
    mem8[TWO_PAIR_FIGURE_ANIM_PHASE] = 0;
  }

  function blitFigure(firstTile) {
    mem8[TWO_PAIR_FIGURE_VRAM] = firstTile;
    mem8[(TWO_PAIR_FIGURE_VRAM + 1)] = firstTile + 1;
    mem8[(TWO_PAIR_FIGURE_VRAM + FIGURE_STRIDE)] = firstTile + 2;
    mem8[(TWO_PAIR_FIGURE_VRAM + FIGURE_STRIDE + 1)] = firstTile + 3;
  }
}
