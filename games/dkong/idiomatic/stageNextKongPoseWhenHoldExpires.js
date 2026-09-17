// SPDX-License-Identifier: GPL-3.0-only
/**
 * stageNextKongPoseWhenHoldExpires — a timer-gated step of the board-cleared interlude
 * (odd boards 25m and 75m): hold the current pose while SUBSTATE_TIMER counts down, then on
 * expiry copy this step's 40-byte sprite-object animation frame into SPRITE_OBJ_BLOCK,
 * re-arm the timer, advance BOARD_ADVANCE_STEP, and on 75m only nudge every record's Y +4.
 *
 * LIVE-OUT: memory-only.
 */

import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { boardBitGate } from "./boardBitGate.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";
import { SUBSTATE_TIMER, SPRITE_OBJ_BLOCK, BOARD_ADVANCE_STEP } from "./names.js";

const ANIM_FRAME_SRC = 0x3932;
const POSE_HOLD_FRAMES = 0x20;
const BOARD_MASK_75M = 0x04; // per-board mask: bit2 = 75m only
const Y_COLUMN = SPRITE_OBJ_BLOCK + 3; // field 3 (Y byte) of sprite-object record 0
const Y_NUDGE = 0x04;

export function stageNextKongPoseWhenHoldExpires(m) {
  const { regs, mem8 } = m;

  if (!tickSubstateTimer(m)) return;

  regs.hl = ANIM_FRAME_SRC;
  loadSpriteObjectBlock(m);

  mem8[SUBSTATE_TIMER] = POSE_HOLD_FRAMES;
  mem8[BOARD_ADVANCE_STEP] = (mem8[BOARD_ADVANCE_STEP] + 1) & 0xff;

  regs.a = BOARD_MASK_75M;
  if (!boardBitGate(m)) return;

  // 75m only: add +4 to the Y column of all ten sprite-object records.
  regs.hl = Y_COLUMN;
  regs.c = Y_NUDGE;
  addToSpriteObjectColumn(m);
}
