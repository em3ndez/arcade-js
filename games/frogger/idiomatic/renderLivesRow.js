// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderLivesRow — render the lives/level row: stamp the life-marker tile down a column.
 * LIVE-OUT: memory-only.
 */
import { loc_83b7, loc_a87e } from "./names.js";

const MARKER_TILE = 76;
const ROW_STRIDE = 32;
const MAX_MARKERS = 15;
const ZERO_DRAWS_FULL_RUN = 256; // a zero count runs the 8-bit loop counter all the way round

export function renderLivesRow(m) {
  const { mem8 } = m;
  const count = Math.min(mem8[loc_83b7], MAX_MARKERS);
  const markers = count === 0 ? ZERO_DRAWS_FULL_RUN : count;
  let p = loc_a87e;
  for (let i = 0; i < markers; i++) {
    mem8[p] = MARKER_TILE;
    p = (p + ROW_STRIDE) & 0xffff;
  }
}
