// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchColorCascadeByBoard — per-frame colour-cascade dispatcher: route by the current board
 * on its low two bits. Even boards (50m/100m) take the X-shift arm; 25m nudges the sprite-object
 * Y column up 4px first; 75m goes straight to the colour-cycle repaint, which both odd boards share.
 *
 * LIVE-OUT: memory-only — the sprite-object Y column on 25m, plus whatever the colour-cycle arms
 * paint.
 */

import { BOARD, SPRITE_OBJ_BLOCK, SPRITE_Y } from "./names.js";
import { shiftEvenBoardSpriteColumn } from "./shiftEvenBoardSpriteColumn.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";
import { dispatchColorCyclePaint } from "./dispatchColorCyclePaint.js";

const BOARD_BIT0 = 0x01;
const BOARD_BIT1 = 0x02;
const Y_SHIFT = 0xfc; // signed byte −4

export function dispatchColorCascadeByBoard(m) {
  const { mem8 } = m;

  const board = mem8[BOARD];

  if ((board & BOARD_BIT0) === 0) {
    shiftEvenBoardSpriteColumn(m);
    return;
  }

  if ((board & BOARD_BIT1) === 0) {
    addToSpriteObjectColumn(m, SPRITE_OBJ_BLOCK + SPRITE_Y, Y_SHIFT);
  }

  dispatchColorCyclePaint(m);
}
