// SPDX-License-Identifier: GPL-3.0-only
import { queueSoundCommand00 } from "./queueSoundCommand00.js";
import { u16 } from "../../../core/int.js";
import { zeroSpriteListAndActorArena } from "./zeroSpriteListAndActorArena.js";
import {
  GAME_ACTIVE_FLAG,
  PLAY_STATE_INDEX,
  ACTIVE_PLAYER,
  TWO_PLAYER_FLAG,
  ATTRACT_SUBSTATE,
  MAIN_GAME_STATE,
  FLIP_SCREEN_FLAG,
  LAUNCH_ARMED_FLAG,
  DISPLAY_MSG_BUF,
  ATTRACT_INIT_MESSAGE_SRC,
} from "./names.js";

const MSG_TERMINATOR = 0x7f; // sentinel ending the table

/**
 * resetGameToAttractState — cold-teardown tail of the play-state dispatch handler.
 *
 * Zeroes the in-play state block (game-active, play-state index, active player, two-player flag,
 * attract sub-state), seeds the fresh-start flags (main state = 1, flip-screen = 1, launch-armed =
 * 1), zeroes the board RAM and posts sound command 0, then unpacks the packed message source table
 * (each byte >> 1) into the display-message buffer until the terminator.
 *
 * LIVE-OUT: none — a teardown tail; all effect lands in memory.
 */
export function resetGameToAttractState(m) {
  const { mem8 } = m;

  mem8[GAME_ACTIVE_FLAG] = 0;
  mem8[PLAY_STATE_INDEX] = 0;
  mem8[ACTIVE_PLAYER] = 0;
  mem8[TWO_PLAYER_FLAG] = 0;
  mem8[ATTRACT_SUBSTATE] = 0;
  mem8[MAIN_GAME_STATE] = 1;
  mem8[FLIP_SCREEN_FLAG] = 1;
  mem8[LAUNCH_ARMED_FLAG] = 1;

  zeroSpriteListAndActorArena(m); // zero the board RAM regions
  queueSoundCommand00(m); // post sound command 0

  let src = ATTRACT_INIT_MESSAGE_SRC;
  let dst = DISPLAY_MSG_BUF;
  for (;;) {
    const b = mem8[src];
    if (b === MSG_TERMINATOR) return; // terminator: nothing more to unpack
    mem8[dst] = b >> 1;
    src = u16(src + 1);
    dst = u16(dst + 1);
  }
}
