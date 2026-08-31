// SPDX-License-Identifier: GPL-3.0-only
import { queueCreditDisplayCommands } from "./queueCreditDisplayCommands.js";
import { resetActorStateForBoard } from "./resetActorStateForBoard.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { fillByteRun } from "./fillByteRun.js";
import {
  ACTIVE_PLAYER,
  TWO_PLAYER_FLAG,
  PLAY_STATE_INDEX,
  MAIN_GAME_STATE,
  GAME_ACTIVE_FLAG,
  FLIP_SCREEN_FLAG,
  WAVE_EVENT_LATCH,
  PERIODIC_EVENT_TIMER,
  ATTRACT_SETUP_DISPLAY_CMD_A,
  START_OF_LIFE_DISPLAY_CMD,
  START_OF_LIFE_DISPLAY_CMD_2P,
  ANIM_WORK_BLOCK_PTR,
} from "./names.js";
/**
 * startNewGamePlay — start-of-life setup for a new game.
 *
 * Records the active-player word (low byte -> player index, high byte -> the two-player flag), runs
 * the pre-play display setup, then seeds the top-level state (in-play flag, main state 3, play
 * sub-state 0, flip-screen normal), enqueues the start display command, resets the actor tables,
 * primes the periodic-event pair (latch clear, timer reload), and enqueues the start-of-life sound.
 * On a two-player game it also enqueues the second-player variant and clears a 12-byte panel block.
 *
 * LIVE-OUT: memory only — callers read no register back.
 */
const MAIN_STATE_PLAY = 3; //     top-level state value for in-play
const PERIODIC_RELOAD = 0x20; //  periodic-event timer reload

export function startNewGamePlay(m, player = m.regs.hl) {
  const { mem8 } = m;

  mem8[ACTIVE_PLAYER] = player; //         low byte -> active-player index
  mem8[TWO_PLAYER_FLAG] = (player >> 8); // high byte -> two-player flag
  queueCreditDisplayCommands(m); //  pre-play display setup

  mem8[PLAY_STATE_INDEX] = 0;
  mem8[MAIN_GAME_STATE] = MAIN_STATE_PLAY;
  mem8[GAME_ACTIVE_FLAG] = 1;
  mem8[FLIP_SCREEN_FLAG] = 1;
  enqueueDisplayCommand(m, ATTRACT_SETUP_DISPLAY_CMD_A); //  enqueue the pre-play start command

  resetActorStateForBoard(m); //  reset the actor/sprite tables

  mem8[WAVE_EVENT_LATCH] = 0;
  mem8[PERIODIC_EVENT_TIMER] = PERIODIC_RELOAD;
  enqueueDisplayCommand(m, START_OF_LIFE_DISPLAY_CMD); //  enqueue the start-of-life sound

  if ((mem8[TWO_PLAYER_FLAG] & 1) === 0) return; //  one-player: done

  enqueueDisplayCommand(m, START_OF_LIFE_DISPLAY_CMD_2P); //  second-player variant
  fillByteRun(m, ANIM_WORK_BLOCK_PTR, 0, 12); //  clear the 12-byte panel block
}
