// SPDX-License-Identifier: GPL-3.0-only

/** drainForegroundThenYieldEachVblank — the foreground main loop as the vblank coroutine.
 *
 * The foreground free-runs several times a frame, paced only by a busy-delay that writes no state;
 * all per-frame accumulation is in the NMI. So it is a per-frame fixed point (verified full-RAM,
 * 700+ frames). This generator drops the busy-delay, drains the body to that fixed point (two passes;
 * the second only settles the life-restart cascade), then yields for the engine to fire the NMI.
 * `entry` threads the head/tail re-entry across passes; the NMI and leaf tree are reached via m.call. */

import {
  GAME_MODE, PLAY_FLAG, START_LATCH, CREDIT_BCD, IN1_PORT, MAIN_LOOP_HEAD, PACE_TAIL,
  FROG_HOP_VERTICAL_DELTA, FROG_HOP_HORIZONTAL_DELTA, FROG_HOP_DOWN_ANIM_RELOAD,
  FROG_HOP_UP_ANIM_RELOAD, FROG_HOP_RIGHT_ANIM_RELOAD, FROG_HOP_LEFT_ANIM_RELOAD, NUM_PLAYERS,
  ACTIVE_PLAYER, LIVES_COUNT, PLAYER1_LIVES, INPLAY_COUNTDOWN_WORD, FROG_TIMER_A, HOME_COLUMN_STATE,
  loc_842d, PLAYER1_DIFFICULTY_INDEX, HOLD_FLAG, PLAYER_START_DEMO_FLAG, SOUND_SEQUENCE_COUNTDOWN,
  WORK_PAGE_SAVE_BANK, SPRITE_OBJECT_RECORD_A_P1, loc_803d, loc_8071,
} from "./names.js";
import { bcdSubByte } from "../../../core/bcd.js";
import { renderScoreHeader } from "./renderScoreHeader.js";
import { renderCreditLine } from "./renderCreditLine.js";
import { initNewGameScoreAndTimers } from "./initNewGameScoreAndTimers.js";
import { clearSoundQueue } from "./clearSoundQueue.js";
import { loadActivePlayerLaneParams } from "./loadActivePlayerLaneParams.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";
import { clearTilemapToTile16 } from "./clearTilemapToTile16.js";
import { clearActivePlayerWorkRam } from "./clearActivePlayerWorkRam.js";
import { dispatchGameModeFrame } from "./dispatchGameModeFrame.js";
import { setUpPlayStartOnce } from "./setUpPlayStartOnce.js";
import { setUpBoardOrContinueLife } from "./setUpBoardOrContinueLife.js";

export function* drainForegroundThenYieldEachVblank(m) {
  let entry = MAIN_LOOP_HEAD;
  for (;;) {
    entry = runOneForegroundPass(m, entry);
    entry = runOneForegroundPass(m, entry);
    yield;
  }
}

// Run one foreground pass from `entry`, returning the entry the NEXT pass takes. Exported so the
// go-live byte-exact harness can drive it from a golden anchor to isolate the model from boot.
export function runOneForegroundPass(m, entry) {
  const { mem8 } = m;

  if (entry === MAIN_LOOP_HEAD) {
    if (mem8[GAME_MODE] >= 0x02) dispatchGameModeFrame(m); // mode>=2 attract dispatch
    renderScoreHeader(m);
    if (mem8[GAME_MODE] !== 1) renderCreditLine(m);
    setUpPlayStartOnce(m);
    mem8[FROG_HOP_VERTICAL_DELTA] = 0x02; mem8[FROG_HOP_HORIZONTAL_DELTA] = 0x02;
    mem8[FROG_HOP_DOWN_ANIM_RELOAD] = 0x09; mem8[FROG_HOP_UP_ANIM_RELOAD] = 0x09;
    mem8[FROG_HOP_RIGHT_ANIM_RELOAD] = 0x09; mem8[FROG_HOP_LEFT_ANIM_RELOAD] = 0x09;
  }

  // pace tail — the busy-delay is skipped: it writes no state.
  if (mem8[PLAY_FLAG] !== 0) {
    setUpBoardOrContinueLife(m); // runs one in-play pass; it returns here, so the frame yields next
    return PACE_TAIL;     // in-play stays at the tail, skipping the head
  }

  if (mem8[START_LATCH] !== 0) return MAIN_LOOP_HEAD;

  // IN1 bit7 = START1, bit6 = START2 (the ROM rotates them out of A one at a time)
  const in1 = mem8[IN1_PORT];
  let players;
  if ((in1 & 0x80) === 0) {
    players = 0x01;
  } else if ((in1 & 0x40) !== 0) {
    return MAIN_LOOP_HEAD;
  } else {
    players = 0x02;
  }

  if (mem8[CREDIT_BCD] < players) return MAIN_LOOP_HEAD; // not enough credits (BCD compare, monotone in the byte)

  startNewGame(m, players);
  setUpBoardOrContinueLife(m);
  return PACE_TAIL;
}

// The one-time new-game setup: deduct the credit, clear the play RAM, seed game state.
function startNewGame(m, players) {
  const { mem8, mem16 } = m;

  mem8[CREDIT_BCD] = bcdSubByte(mem8[CREDIT_BCD], players).value; // BCD deduct
  mem8[NUM_PLAYERS] = players;

  for (let i = 0; i < 0x200; i++) mem8[WORK_PAGE_SAVE_BANK + i] = 0; // clear the play RAM (0x200 bytes)

  mem8[PLAY_FLAG] = players; // player count -- a game is now in progress (oracle loc_0341:168/183; was buggy: wrote stale credit)
  mem8[ACTIVE_PLAYER] = 0x01;
  mem8[START_LATCH] = 0x01;
  mem8[LIVES_COUNT] = 0x01;
  mem16[PLAYER1_LIVES] = 257; // 0x0101: P1 + P2 lives byte both = 1

  initNewGameScoreAndTimers(m);
  mem8[loc_803d] = 0x03;
  clearSoundQueue(m);
  mem8[loc_8071] = 0x00;

  enqueueSoundCommand(m, 0x00);
  enqueueSoundCommand(m, 0x09);
  enqueueSoundCommand(m, 0x0a);
  enqueueSoundCommand(m, 0x0b);

  mem16[INPLAY_COUNTDOWN_WORD] = 32;
  mem16[SOUND_SEQUENCE_COUNTDOWN] = 416;
  mem16[FROG_TIMER_A] = 0;

  clearActivePlayerWorkRam(m);
  clearTilemapToTile16(m);
  loadActivePlayerLaneParams(m);

  mem8[HOME_COLUMN_STATE] = 0x00;
  mem8[loc_842d] = 0x00;
  mem16[PLAYER1_DIFFICULTY_INDEX] = 0;

  for (let i = 0; i < 0x50; i++) mem8[SPRITE_OBJECT_RECORD_A_P1 + i] = 0; // clear a second play-RAM block (0x50 bytes)

  mem8[HOLD_FLAG] = 0x00;
  mem8[PLAYER_START_DEMO_FLAG] = 0x01;
}
