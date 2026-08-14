// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1a02 — seed the object-animation state at board init: fill two stride-2 cell blocks from
 * fixed value tables (cell i of a block takes seed i).
 * LIVE-OUT: memory-only.
 */
import { loc_8021, loc_800d } from "./names.js";

const ANIM_CELL_SEEDS = [6, 6, 5, 5, 5, 5, 4, 4, 5, 5, 7, 7, 6, 6];
const ANIM_STATE_SEEDS = [2, 2, 5, 5, 2, 2, 2, 2, 5, 5];

export function loc_1a02(m) {
  const { mem8 } = m;

  for (let i = 0; i < ANIM_CELL_SEEDS.length; i++) {
    mem8[(loc_8021 + 2 * i) & 0xffff] = ANIM_CELL_SEEDS[i];
  }
  for (let i = 0; i < ANIM_STATE_SEEDS.length; i++) {
    mem8[(loc_800d + 2 * i) & 0xffff] = ANIM_STATE_SEEDS[i];
  }
}
