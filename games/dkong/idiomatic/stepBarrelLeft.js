// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepBarrelLeft — the -X motion arm of the barrel walk: bank the register file, stage the two
 * direction constants the shared roll tail consumes, and decrement this barrel's OBJ_X.
 * The tail's slope-step selector (255) snaps Y one pixel along the slope as X crosses a 16-pixel
 * cell boundary, firing at offset 15 — the edge a decrementing barrel enters a new cell on; the
 * +X arm passes 1/0 instead, so the wrong pairing snaps on the wrong edge. The second constant is
 * a direction code the sprite-orientation refresh folds in as `3 | code`.
 * WARNING: exx() lets the walk's loop state survive in the main bank; the sprite publish swaps back.
 */

import { OBJ_X } from "./names.js";

const SHARED_TAIL = 0x1ff6;
const SLOPE_STEP_SELECTOR = 255;
const ORIENTATION_DIRECTION = 4;

export function stepBarrelLeft(m, objBase = m.regs.ix) {
  const { mem8, regs } = m;

  regs.exx();

  mem8[objBase + OBJ_X] = mem8[objBase + OBJ_X] - 1;

  // The b/c writes ride the return so the register bridge survives the shared-tail call (off the gate).
  return (regs.b = SLOPE_STEP_SELECTOR, regs.c = ORIENTATION_DIRECTION, m.call(SHARED_TAIL));
}
