// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceBoardStepWhenSpritesCleared — one arm of the board-advance sequence: sweep the
 * sprite-object block toward the top and, once it is fully empty, arm the wait timer and step
 * to the next arm. Each frame runs the block animation and top cull, advances the scan
 * pointer/stride by one, then checks whether all ten record X bytes are zero; if a slot is
 * still occupied it aborts and retries next frame with the selector untouched.
 *
 * LIVE-OUT: memory-only — SUBSTATE_TIMER and BOARD_ADVANCE_STEP on the clear arm; the block
 * animation's own phase counter and the swept sprite block on every pass.
 */

import { SUBSTATE_TIMER, BOARD_ADVANCE_STEP } from "./names.js";
import { animateSpriteObjectBlock } from "./animateSpriteObjectBlock.js";
import { cullSpriteObjectsAtTop } from "./cullSpriteObjectsAtTop.js";
import { allSlotsClear } from "./allSlotsClear.js";

const SUBSTATE_DWELL = 0x40; // frames to hold before the next sub-state proceeds

export function advanceBoardStepWhenSpritesCleared(m) {
  const { regs, mem, mem8 } = m;

  animateSpriteObjectBlock(m);
  cullSpriteObjectsAtTop(m);

  regs.hl = (regs.hl + 1) & 0xffff;
  regs.de = (regs.de + 1) & 0xffff;

  if (!allSlotsClear(mem, regs.hl, regs.de)) return;

  mem8[SUBSTATE_TIMER] = SUBSTATE_DWELL;
  mem8[BOARD_ADVANCE_STEP] = (mem8[BOARD_ADVANCE_STEP] + 1) & 0xff;
}
