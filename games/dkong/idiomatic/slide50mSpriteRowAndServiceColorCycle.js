// SPDX-License-Identifier: GPL-3.0-only
/**
 * slide50mSpriteRowAndServiceColorCycle — service the per-frame colour cycle; on the 50m board
 * only, first slide the whole sprite-object row by the 50m object's step and publish the resulting
 * X-shift delta for the column painter.
 *
 * LIVE-OUT: memory-only — the caller services the colour cycle and reads nothing back.
 */

import { BOARD, SPRITE_OBJ_BLOCK, M50_OBJ1_STEP, M50_OBJ_ROW_SHIFT } from "./names.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";
import { serviceColorCycle } from "./serviceColorCycle.js";

const SPRITE_OBJ_REC2_X = SPRITE_OBJ_BLOCK + 8;

export function slide50mSpriteRowAndServiceColorCycle(m) {
  const { regs, mem8 } = m;

  if (mem8[BOARD] !== 2) {
    serviceColorCycle(m);
    return;
  }

  regs.hl = SPRITE_OBJ_BLOCK;
  regs.c = mem8[M50_OBJ1_STEP];
  addToSpriteObjectColumn(m);

  mem8[M50_OBJ_ROW_SHIFT] = mem8[SPRITE_OBJ_REC2_X] - 0x3b;

  serviceColorCycle(m);
}
