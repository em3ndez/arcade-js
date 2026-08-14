// SPDX-License-Identifier: GPL-3.0-only
/**
 * animateTwoPairFigure — advance the two-pair figure animation: idle-clears the phase, or when
 * armed steps it and blits a figure at phases 64 and 112 (the latter restarts it).
 * LIVE-OUT: memory-only.
 */
import { loc_8101, loc_8150, loc_814f, loc_833f, loc_a846 } from "./names.js";

const FIGURE_STRIDE = 32; // second tile pair sits one row below the first
const PHASE_BLIT_A = 64;
const PHASE_BLIT_B = 112;
const FRAME_A_FIRST_TILE = 104;
const FRAME_B_FIRST_TILE = 208;

export function animateTwoPairFigure(m) {
  const { mem8 } = m;

  if (mem8[loc_8101] === 0) {
    mem8[loc_833f] = 0;
    return;
  }
  if ((mem8[loc_8150] & 1) === 0) return;
  if (mem8[loc_814f] !== 0) return;

  const phase = (mem8[loc_833f] + 1) & 0xff;
  mem8[loc_833f] = phase;
  if (phase === PHASE_BLIT_A) {
    blitFigure(FRAME_A_FIRST_TILE);
  } else if (phase === PHASE_BLIT_B) {
    blitFigure(FRAME_B_FIRST_TILE);
    mem8[loc_833f] = 0;
  }

  function blitFigure(firstTile) {
    mem8[loc_a846] = firstTile;
    mem8[(loc_a846 + 1) & 0xffff] = firstTile + 1;
    mem8[(loc_a846 + FIGURE_STRIDE) & 0xffff] = firstTile + 2;
    mem8[(loc_a846 + FIGURE_STRIDE + 1) & 0xffff] = firstTile + 3;
  }
}
