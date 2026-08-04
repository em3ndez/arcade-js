// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0400 — on the 50m arm, stage the sprite-object row's X-shift; then, on every arm, hand off
 * to the per-frame colour-cycle service.
 *
 * This is a mid-body entry point: the caller has already compared the current board against 50m
 * and this routine reads that decision from the flag the compare left behind, rather than making
 * it again.
 *
 *   - board is NOT 50m -> straight into the per-frame colour-cycle service.
 *   - board IS 50m     -> shift the sprite-object block's X column by object 1's published step,
 *                         stage this frame's row-shift delta, then the same colour-cycle service.
 *
 * The 50m arm, in order:
 *   1. Add object 1's signed X-step (M50_OBJ1_STEP) into the X field of all ten sprite-object
 *      records at once, through the shared column-add — repositioning the whole row horizontally
 *      by one number.
 *   2. Read the X byte of the block's third record, which step 1 has just shifted, subtract 0x3b
 *      from it, and store the result as M50_OBJ_ROW_SHIFT — the row-shift delta the 50m
 *      colour-cascade arm reads back later. The read happens AFTER the column shift, so the staged
 *      delta reflects the shifted position and not the pre-shift one.
 *   3. Fall into the colour-cycle service, exactly as the not-50m arm does.
 *
 * The shared column-add takes its target column and signed delta in registers, so both are loaded
 * before that call; the colour-cycle service reads everything it needs out of memory and takes no
 * arguments.
 *
 * LIVE-OUT: memory-only — the shifted sprite-object X column, the staged row-shift delta, and
 * whatever the colour-cycle service paints.
 */

import { SPRITE_OBJ_BLOCK, M50_OBJ1_STEP, M50_OBJ_ROW_SHIFT } from "./names.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";
import { serviceColorCycle } from "./serviceColorCycle.js";

export function loc_0400(m) {
  const { regs, mem } = m;

  // The branch decider is a live-in flag from the caller's board compare: the "not equal to 50m"
  // outcome routes straight to the colour-cycle service with no row work.
  if (regs.fNZ) {
    serviceColorCycle(m);
    return;
  }

  // 50m arm. Shift the X column of all ten sprite-object records by object 1's signed step.
  regs.hl = SPRITE_OBJ_BLOCK; // the X field of the block's first record
  regs.c = mem.read8(M50_OBJ1_STEP);
  addToSpriteObjectColumn(m);

  // Stage this frame's row-shift delta: the (now-shifted) X byte of the third record less 0x3b.
  // The store truncates, so the subtraction's 8-bit wrap needs no explicit mask.
  mem.write8(M50_OBJ_ROW_SHIFT, mem.read8(SPRITE_OBJ_BLOCK + 8) - 0x3b); // record 2's X in SPRITE_OBJ_BLOCK

  // Then the same colour-cycle service the not-50m arm runs.
  serviceColorCycle(m);
}
