// SPDX-License-Identifier: GPL-3.0-only
/**
 * runRivetBoardFinaleThenAdvanceLevel — one frame of the rivet board's end-of-board finale. Ticks
 * the pace counter; on its 0-crossing the finale is over, so it steps the board order on, increments
 * LEVEL, posts a deferred task, and hands off to the interlude sub-state. Otherwise, once every 8th
 * tick it steps the two blink flags and, at two specific counter values, seeds the transition sprite
 * (position/code by Mario's half of the screen) or writes the sound cue and its object record.
 *
 * LIVE-OUT: memory only.
 */

import {
  MARIO_X,
  LEVEL,
  SND_PRIORITY,
  SND_PRIORITY_FRAMES,
  BOARD,
  BOARD_SEQ_PTR,
  HOW_HIGH_INDEX,
  SUBSTATE_TIMER,
  GAME_SUBSTATE,
  BOARD_ADVANCE_STEP,
} from "./names.js";
import { nextAnimationStep } from "./nextAnimationStep.js";
import { enqueueTask } from "./enqueueTask.js";

const FINALE_PACE_COUNTER = 0x62af;

const FINALE_BLINK_FLAG = 0x6a25;
const FINALE_ANIM_FLAG = 0x6919;
const FINALE_BLINK_BIT = 0x80;
const FINALE_ANIM_BIT = 0x20;

const CUTSCENE_SPRITE_X = 0x694c;
const CUTSCENE_SPRITE_CODE = 0x694d;
const CUTSCENE_SPRITE_Y = 0x694f;

const FINALE_OBJECT_RECORD = 0x6a20;
const FINALE_OBJECT_BYTE0_LEFT = 0x6f;

const STAGE_AT = 0xe0;
const SOUND_AT = 0xc0;

const SCREEN_MIDPOINT = 0x80;

const BOARD_TABLE_TERMINATOR = 0x7f;
const BOARD_TABLE_REPEAT_GROUP = 0x3a73;

export function runRivetBoardFinaleThenAdvanceLevel(m) {
  const { mem8 } = m;

  const counter = (mem8[FINALE_PACE_COUNTER] - 1) & 0xff;
  mem8[FINALE_PACE_COUNTER] = counter;
  if (counter === 0) {
    advanceBoardSequence(m);
    return;
  }

  if ((counter & 0x07) !== 0) return;

  mem8[FINALE_BLINK_FLAG] = mem8[FINALE_BLINK_FLAG] ^ FINALE_BLINK_BIT;
  const animInput = mem8[FINALE_ANIM_FLAG] & ~FINALE_ANIM_BIT & 0xff;
  const sel = nextAnimationStep(0x00, animInput);
  mem8[FINALE_ANIM_FLAG] = sel.a | FINALE_ANIM_BIT;

  if (counter === STAGE_AT) {
    mem8[CUTSCENE_SPRITE_Y] = 0x50;
    if (mem8[MARIO_X] < SCREEN_MIDPOINT) {
      mem8[CUTSCENE_SPRITE_CODE] = 0x80;
      mem8[CUTSCENE_SPRITE_X] = 0x5f;
    } else {
      mem8[CUTSCENE_SPRITE_CODE] = 0x00;
      mem8[CUTSCENE_SPRITE_X] = 0x9f;
    }
    return;
  }
  if (counter !== SOUND_AT) return;

  mem8[SND_PRIORITY] = mem8[LEVEL] & 0x01 ? 0x0c : 0x05;
  mem8[SND_PRIORITY_FRAMES] = 0x03;
  mem8[FINALE_OBJECT_RECORD + 0] = 0x8f;
  mem8[FINALE_OBJECT_RECORD + 1] = 0x76;
  mem8[FINALE_OBJECT_RECORD + 2] = 0x09;
  mem8[FINALE_OBJECT_RECORD + 3] = 0x40;
  if (mem8[MARIO_X] < SCREEN_MIDPOINT) {
    mem8[FINALE_OBJECT_RECORD] = FINALE_OBJECT_BYTE0_LEFT;
  }
}

/**
 * The counter's 0-crossing tail: step the board order on to the next board, count the level, and
 * hand the game to the interlude sub-state.
 */
function advanceBoardSequence(m) {
  const { regs, mem8, mem16 } = m;

  let ptr = (mem16[BOARD_SEQ_PTR] + 1) & 0xffff;
  let nextBoard = mem8[ptr];
  if (nextBoard === BOARD_TABLE_TERMINATOR) {
    ptr = BOARD_TABLE_REPEAT_GROUP;
    nextBoard = mem8[ptr];
  }
  mem16[BOARD_SEQ_PTR] = ptr;
  mem8[BOARD] = nextBoard;
  mem8[LEVEL] = mem8[LEVEL] + 1;

  regs.de = 0x0500;
  enqueueTask(m);

  mem8[HOW_HIGH_INDEX] = 0x00;
  mem8[BOARD_ADVANCE_STEP] = 0x00;
  mem8[SUBSTATE_TIMER] = 0xe0;
  mem8[GAME_SUBSTATE] = 0x08;
}
