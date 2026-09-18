// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepBarrelLeft — the -X motion arm of the barrel walk: bank the register file, stage the two
 * direction constants the shared roll tail consumes, and decrement this barrel's OBJ_X.
 *
 * The tail hands the slope-step selector (255) to the girder snap: it moves Y one pixel along the
 * slope only as X crosses a 16-pixel cell boundary, and the not-1 selector fires at offset 15 —
 * the edge a decrementing barrel enters a new cell on. The mirror +X arm passes 1 and 0 instead,
 * so pairing a decrement with the wrong constants silently snaps on the wrong edge. The second
 * constant is a direction code the sprite-orientation refresh folds in as `3 | code`.
 *
 * WARNING: exx() lets the walk's loop state survive in the main bank; the sprite publish swaps
 * back. The record base stays in ix by default, not forced as a parameter.
 */

import { OBJ_X } from "./names.js";

const SHARED_TAIL = 0x1ff6;
const SLOPE_STEP_SELECTOR = 255;
const ORIENTATION_DIRECTION = 4;

export function stepBarrelLeft(
  m,
  objBase = m.regs.ix,
) {
  const { mem8, regs } = m;

  regs.exx();

  regs.b = SLOPE_STEP_SELECTOR;
  regs.c = ORIENTATION_DIRECTION;

  mem8[objBase + OBJ_X] = mem8[objBase + OBJ_X] - 1;

  return m.call(SHARED_TAIL);
}
