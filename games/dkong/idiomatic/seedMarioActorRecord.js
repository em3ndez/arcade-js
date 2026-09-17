// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedMarioActorRecord — spawn Mario's actor record at a board-dependent start,
 * advance the sub-state, and post the follow-up task.
 *
 * A one-shot setup step gated by SUBSTATE_TIMER: the body fires only on the frame the
 * timer expires. Mario's start position comes from BOARD (75m gets a different spot),
 * both his actor record and its 4-byte sprite mirror are seeded, GAME_SUBSTATE is
 * advanced, and the follow-up task is enqueued.
 *
 * LIVE-OUT: memory-only — Mario's actor fields, his sprite mirror, GAME_SUBSTATE,
 * SUBSTATE_TIMER, and the task ring.
 */

import {
  BOARD, GAME_SUBSTATE,
  MARIO_ACTIVE, MARIO_X, MARIO_Y, MARIO_SPRITE_CODE, MARIO_SPRITE_ATTR,
  MARIO_MOVE_STEP_TIMER, MARIO_SPRITE_RECORD,
} from "./names.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { enqueueTask } from "./enqueueTask.js";

export function seedMarioActorRecord(m) {
  const { regs, mem8 } = m;

  // Gate: skip until SUBSTATE_TIMER expires.
  if (!tickSubstateTimer(m)) return;

  const board3 = mem8[BOARD] === 0x03; // 75m
  const startX = board3 ? 0x16 : 0x3f;
  const startY = board3 ? 0xe0 : 0xf0;

  mem8[MARIO_ACTIVE] = 0x01;
  mem8[MARIO_X] = startX;
  mem8[MARIO_SPRITE_RECORD + 0] = startX;
  mem8[MARIO_SPRITE_CODE] = 0x80;
  mem8[MARIO_SPRITE_RECORD + 1] = 0x80;
  mem8[MARIO_SPRITE_ATTR] = 0x02;
  mem8[MARIO_SPRITE_RECORD + 2] = 0x02;
  mem8[MARIO_Y] = startY;
  mem8[MARIO_SPRITE_RECORD + 3] = startY;
  mem8[MARIO_MOVE_STEP_TIMER] = 0x01;

  mem8[GAME_SUBSTATE] = (mem8[GAME_SUBSTATE] + 1) & 0xff;

  regs.d = 0x06;
  regs.e = 0x01;
  enqueueTask(m);
}
