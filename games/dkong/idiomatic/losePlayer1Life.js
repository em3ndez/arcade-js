// SPDX-License-Identifier: GPL-3.0-only
/**
 * losePlayer1Life — spend one of player 1's lives, save what carries over to the next turn, and
 * send the game to the between-turns interlude or to game over. Runs once the death animation
 * finishes: silence sound, clear the play-intro flag, take a life, snapshot the 8-byte player
 * context (after those two so the saved slot is post-death), then branch — lives remain go to
 * the resume interlude (a different sub-state for 1- vs 2-player), none left runs the game-over
 * sequence (format the score, stamp the banner, queue the render, arm the timed sub-state).
 *
 * LIVE-OUT: memory-only.
 */

import { silenceSound } from "./silenceSound.js";
import { loc_13ca } from "./loc_13ca.js";
import { enqueueTask } from "./enqueueTask.js";
import { loc_1826 } from "../translated/loc_1826.js";
import {
  GAMEOVER_BANNER_TOPLEFT_1P,
  GAME_SUBSTATE,
  LIVES,
  P1_CONTEXT,
  P1_SCORE,
  PLAY_INTRO,
  SUBSTATE_TIMER,
  TWO_PLAYER_GAME,
} from "./names.js";

const CONTEXT_BYTES = 8; // the live player-context block, saved off starting at the life count

const RESUME_SUBSTATE_1P = 0x08; // lives remain, 1-player -> the resume interlude
const RESUME_SUBSTATE_2P = 0x17; // lives remain, 2-player -> the player-alternation screen

const GAMEOVER_SUBSTATE = 0x10; // no lives left -> the game-over display sequence
const GAMEOVER_WAIT = 0xc0; //     the hold (~192 frames) before that sequence runs

const SCORE_FORMAT_P1 = 0x01; //   selects player 1's slot for the score format/rank step

export function losePlayer1Life(m) {
  const { regs, mem8 } = m;

  silenceSound(m);

  // Skip the next life's intro and spend a life before the snapshot, so the saved slot is post-death.
  mem8[PLAY_INTRO] = 0;
  mem8[LIVES] = (mem8[LIVES] - 1);
  const remaining = mem8[LIVES];

  // Source and destination do not overlap, so a plain forward copy is faithful.
  for (let i = 0; i < CONTEXT_BYTES; i++) {
    mem8[(P1_CONTEXT + i) & 0xffff] = mem8[(LIVES + i) & 0xffff];
  }

  if (remaining !== 0) {
    const twoPlayer = mem8[TWO_PLAYER_GAME] !== 0;
    mem8[GAME_SUBSTATE] = twoPlayer ? RESUME_SUBSTATE_2P : RESUME_SUBSTATE_1P;
    return;
  }

  // No lives left: format player 1's final score for display and ranking.
  loc_13ca(m, SCORE_FORMAT_P1, P1_SCORE);

  // In a 2-player game the banner starts one column left, with an extra render task ahead of it.
  let bannerTop = GAMEOVER_BANNER_TOPLEFT_1P;
  if (mem8[TWO_PLAYER_GAME] !== 0) {
    enqueueTask(m, 0x03, 0x02);
    bannerTop = (GAMEOVER_BANNER_TOPLEFT_1P - 1) & 0xffff;
  }
  regs.hl = bannerTop;
  loc_1826(m); // fills 70 tiles from there

  enqueueTask(m, 0x03, 0x00);
  mem8[SUBSTATE_TIMER] = GAMEOVER_WAIT;
  mem8[GAME_SUBSTATE] = GAMEOVER_SUBSTATE;
}
