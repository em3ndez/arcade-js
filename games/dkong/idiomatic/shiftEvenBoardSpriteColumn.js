// SPDX-License-Identifier: GPL-3.0-only
/**
 * shiftEvenBoardSpriteColumn — the even-board arm of the per-frame colour cascade: shift the
 * sprite-object block's X column by a board-specific delta (50m from RAM, 100m the fixed +0x44),
 * then continue into the colour-cycle repaint.
 *
 * LIVE-OUT: memory-only — the sprite-object X column plus whatever the colour-cycle arms paint.
 */

import { SPRITE_OBJ_BLOCK, BOARD, M50_OBJ_ROW_SHIFT } from "./names.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";
import { dispatchColorCyclePaint } from "./dispatchColorCyclePaint.js";

const DEFAULT_SHIFT = 0x44;
const BOARD_BIT1 = 0x02;

export function shiftEvenBoardSpriteColumn(m) {
  const { regs, mem8 } = m;

  const board = mem8[BOARD];
  const shiftX = (board & BOARD_BIT1) !== 0 ? mem8[M50_OBJ_ROW_SHIFT] : DEFAULT_SHIFT;

  regs.hl = SPRITE_OBJ_BLOCK;
  regs.c = shiftX;
  addToSpriteObjectColumn(m);

  dispatchColorCyclePaint(m);
}
