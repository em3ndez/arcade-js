// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceBoardStepWhenSpritesCleared — one arm of the board-advance sequence:
 * sweep the sprite-object block toward the top and, once it is fully empty, arm the
 * wait timer and step to the next arm of the sequence.
 *
 * Dispatched from inside the vblank interrupt while a board is being torn down, selected by
 * the board-advance sequence counter BOARD_ADVANCE_STEP. Each frame it runs two sprite
 * passes over the ten-record sprite-object block and then decides whether the block has
 * finished clearing:
 *
 *   1. The block animation — every 8th call, scroll the whole block up 4px and flip a few
 *      records. This is what marches the sprites off the top of the screen.
 *   2. The top cull — zero the X of any record that has risen above the top line
 *      (Y < 0x19), and hand back a scan pointer and stride, each one short.
 *   3. Advance that pair by one, to the block start and a stride of 4, and ask whether all
 *      ten record X bytes are now zero.
 *
 * If a slot is still occupied the scan reports not-clear, and this arm aborts: try again
 * next frame, with the sequence counter left alone. If every slot IS clear, arm
 * SUBSTATE_TIMER to 64 frames — the dwell before the next sub-state proceeds — and
 * increment BOARD_ADVANCE_STEP so the next interrupt dispatches the following arm.
 *
 * The one-step pointer advance between the cull and the scan is this routine's own glue:
 * the base and stride the scan receives depend on it.
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
  const { regs, mem } = m;

  // Two sprite passes: march the block up (1-in-8) then cull records off the top.
  animateSpriteObjectBlock(m);
  cullSpriteObjectsAtTop(m); // leaves the block pointer and the stride each one short

  // Advance that pair to the block start and a stride of 4 for the scan below.
  regs.hl = (regs.hl + 1) & 0xffff;
  regs.de = (regs.de + 1) & 0xffff;

  // A slot still occupied -> not done clearing; abort this arm (caller-skip),
  // leaving the sequence selector untouched so the same arm runs again next frame.
  if (!allSlotsClear(mem, regs.hl, regs.de)) return;

  // Block fully cleared: arm the dwell timer and step to the next sequence arm.
  mem.write8(SUBSTATE_TIMER, SUBSTATE_DWELL);
  mem.write8(BOARD_ADVANCE_STEP, (mem.read8(BOARD_ADVANCE_STEP) + 1) & 0xff);
}
