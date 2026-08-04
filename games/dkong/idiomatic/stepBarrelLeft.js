// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepBarrelLeft — the -X motion arm of the barrel walk: bank the register file, stage the two
 * direction constants the shared roll tail consumes, and decrement this barrel's X.
 *
 * Three acts with no branches, and then the tail, which is where everything downstream happens:
 *
 *   • swap the register file to its alternate bank. The walk keeps its loop state —
 *     sprite-buffer pointer, record pointer, stride and remaining count — in the main bank, so
 *     every motion arm works in the alternate one, and the swap back happens where the arms
 *     converge on the shared sprite publish.
 *   • load the two direction constants the tail passes on.
 *   • decrement the record's X field (OBJ_X). The direction in the name is the sign of that
 *     decrement on the record's own X field.
 *
 * WHY 255 AND 4 GO WITH A DECREMENT. The tail hands the first constant to the girder snap as its
 * step selector, along with the X this routine just wrote and the record's Y. The snap moves Y one
 * pixel along the girder slope only on the frame X lands on a 16-pixel cell boundary, and WHICH
 * edge counts is what the selector picks: 1 fires at cell offset 0, any other value fires at cell
 * offset 15. A barrel walking X downwards enters a new cell when its X reaches offset 15, one
 * walking X upwards when it reaches offset 0 — so the not-1 selector is the one that belongs with
 * a decrement. The mirror arm is the confirmation: it is this routine with the increment and the
 * other pair of constants, 1 and 0. The second constant is a direction code the sprite-orientation
 * refresh folds into its lookup selector as `3 | code`; this arm's 4 and the mirror's 0 select
 * different halves of that table.
 *
 * NOT CLAIMED: what the direction code's 4-vs-0 finally does. It was traced only as far as the
 * lookup selector, not to a sprite orientation on the glass.
 *
 * LIVE-OUT: the bank swap, the two constants in the alternate bank, the decremented OBJ_X, and
 * whatever the shared tail returns — propagated unchanged rather than assumed, since the tail
 * forwards a return of its own from whichever arm it takes. The ONLY thing dropped is the
 * condition flags the memory decrement defines.
 */

import { OBJ_X } from "./names.js";

// The shared roll tail this arm falls into.
const SHARED_TAIL = 0x1ff6;

// The slope-step selector the tail hands to the girder snap. Only "is it 1" reaches the
// snap, which fires at cell offset 15 for every other value; the mirror arm passes 1.
const SLOPE_STEP_SELECTOR = 255;

// The direction code the tail hands to the sprite-orientation refresh, which uses it as
// `3 | code` to pick a half of its lookup. The mirror arm passes 0.
const ORIENTATION_DIRECTION = 4;

/**
 * @param {object} m  the machine (memory and the register file the tail reads).
 * @param {number} objBase  base address of the object record being stepped.
 * @returns whatever the shared tail returns, unchanged.
 */
export function stepBarrelLeft(
  m,
  objBase = m.regs.ix /* default: the motion dispatch leaves the record base in this register */,
) {
  const { mem8, regs } = m;

  // Work in the alternate bank so the walk's loop state survives; the sprite publish swaps back.
  regs.exx();

  regs.b = SLOPE_STEP_SELECTOR;
  regs.c = ORIENTATION_DIRECTION;

  mem8[objBase + OBJ_X] = mem8[objBase + OBJ_X] - 1;

  return m.call(SHARED_TAIL);
}
