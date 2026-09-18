// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceInterludeStepAndLiftKongFigure — step the board-advance sequence on
 * (every board), then on the 25m board only subtract 4 from the Y byte of all ten
 * sprite-object records (strided, 4 bytes apart), raising the staged figure 4px.
 *
 * LIVE-OUT: memory-only — the incremented sequence step, and on 25m the ten Y bytes.
 */

import { boardBitGate } from "./boardBitGate.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";
import { SPRITE_OBJ_BLOCK, BOARD_ADVANCE_STEP } from "./names.js";

export function advanceInterludeStepAndLiftKongFigure(m) {
  const { regs, mem8 } = m;

  mem8[BOARD_ADVANCE_STEP] = (mem8[BOARD_ADVANCE_STEP] + 1) & 0xff;

  // 25m only (bit 0 of the board mask); any other board skips the lift.
  if (!boardBitGate(m, 0x01)) return;

  regs.hl = SPRITE_OBJ_BLOCK + 3;
  regs.c = 0xfc; // -4, 8-bit
  addToSpriteObjectColumn(m);
}
