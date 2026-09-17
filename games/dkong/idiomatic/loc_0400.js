// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0400 — a mid-body entry reading the caller's board-vs-50m compare flag. Not 50m: straight
 * into the per-frame colour-cycle service. 50m: shift the sprite-object block's X column by
 * object 1's signed step, stage this frame's row-shift delta (the shifted third record's X less
 * 0x3b) into M50_OBJ_ROW_SHIFT, then the same colour-cycle service.
 *
 * LIVE-OUT: memory-only — the shifted sprite-object X column, the staged row-shift delta, and
 * whatever the colour-cycle service paints.
 */

import { SPRITE_OBJ_BLOCK, M50_OBJ1_STEP, M50_OBJ_ROW_SHIFT } from "./names.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";
import { serviceColorCycle } from "./serviceColorCycle.js";

export function loc_0400(m, nz = m.regs.fNZ) {
  const { regs, mem8 } = m;

  if (nz) {
    serviceColorCycle(m);
    return;
  }

  regs.hl = SPRITE_OBJ_BLOCK; // the X field of the block's first record
  regs.c = mem8[M50_OBJ1_STEP];
  addToSpriteObjectColumn(m);

  mem8[M50_OBJ_ROW_SHIFT] = mem8[SPRITE_OBJ_BLOCK + 8] - 0x3b;

  serviceColorCycle(m);
}
