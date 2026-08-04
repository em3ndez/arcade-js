// SPDX-License-Identifier: GPL-3.0-only
/**
 * losePlayer1Life — spend one of player 1's lives, save what carries over to the next turn, and
 * send the game either to the between-turns interlude or to game over.
 *
 * This runs once player 1's death animation has finished, and it does the book-keeping in a fixed
 * order:
 *
 *   1. Silence every sound.
 *   2. Clear the play-intro flag, so the next life starts without the opening Kong-climb cutscene.
 *   3. Take one life away.
 *   4. Copy the live 8-byte player context — the block that starts at the life count — into player
 *      1's save slot, which the next turn restores from. Steps 2 and 3 happen BEFORE this copy, so
 *      the saved slot carries the reduced life count and the cleared intro flag.
 *   5. Branch on what is left:
 *      - lives remain -> go to the between-turns interlude, which is a different sub-state in a
 *        1-player game than in a 2-player one (the latter is the player-alternation screen).
 *      - none remain  -> player 1 is finished: format the final score for display and ranking,
 *        stamp the game-over banner across the screen, queue the render task, and arm the
 *        "wait 0xC0 frames, then run the game-over sub-state" pattern across the adjacent timer
 *        and sub-state cells. In a 2-player game the banner starts one column further left and an
 *        extra render task is queued ahead of it.
 *
 * LIVE-OUT: memory-only — the life count, the saved player context, the next frame's sub-state and
 * its timer, the queued tasks and, on the game-over arm, the formatted score and the banner.
 */

import { silenceSound } from "./silenceSound.js";
import { loc_13ca } from "./loc_13ca.js";
import { enqueueTask } from "./enqueueTask.js";
import { loc_1826 } from "../translated/loc_1826.js";
import {
  PLAY_INTRO,
  LIVES,
  P1_CONTEXT,
  TWO_PLAYER_GAME,
  P1_SCORE,
  GAME_SUBSTATE,
  SUBSTATE_TIMER,
} from "./names.js";

const CONTEXT_BYTES = 8; // the live player-context block, saved off starting at the life count

const RESUME_SUBSTATE_1P = 0x08; // lives remain, 1-player -> the resume interlude
const RESUME_SUBSTATE_2P = 0x17; // lives remain, 2-player -> the player-alternation screen

const GAMEOVER_SUBSTATE = 0x10; // no lives left -> the game-over display sequence
const GAMEOVER_WAIT = 0xc0; //     the hold (~192 frames) before that sequence runs

const SCORE_FORMAT_P1 = 0x01; //   selects player 1's slot for the score format/rank step
const BANNER_VRAM_TOP = 0x76d4; // where the game-over banner starts on screen

export function losePlayer1Life(m) {
  const { regs, mem } = m;

  // 1. Silence the sound hardware as the life ends.
  silenceSound(m);

  // 2-3. Skip the next life's intro cutscene, then spend one life. Both happen before
  // the snapshot so the saved slot reflects the post-death state.
  mem.write8(PLAY_INTRO, 0);
  mem.write8(LIVES, (mem.read8(LIVES) - 1) & 0xff);
  const remaining = mem.read8(LIVES);

  // 4. Save the live 8-byte context into player 1's slot. Source and destination do not overlap,
  // so a plain forward copy is faithful.
  for (let i = 0; i < CONTEXT_BYTES; i++) {
    mem.write8((P1_CONTEXT + i) & 0xffff, mem.read8((LIVES + i) & 0xffff));
  }

  // 5a. Lives remain: pick the resume sub-state by player count and return.
  if (remaining !== 0) {
    const twoPlayer = mem.read8(TWO_PLAYER_GAME) !== 0;
    mem.write8(GAME_SUBSTATE, twoPlayer ? RESUME_SUBSTATE_2P : RESUME_SUBSTATE_1P);
    return;
  }

  // 5b. No lives left: player 1's game is over.

  // Format player 1's final score for display and ranking.
  regs.a = SCORE_FORMAT_P1;
  regs.hl = P1_SCORE;
  loc_13ca(m);

  // Stamp the game-over banner across the screen. In a 2-player game it starts one column further
  // left and an extra render task is queued ahead of it.
  let bannerTop = BANNER_VRAM_TOP;
  if (mem.read8(TWO_PLAYER_GAME) !== 0) {
    regs.de = 0x0302;
    enqueueTask(m);
    bannerTop = (BANNER_VRAM_TOP - 1) & 0xffff;
  }
  regs.hl = bannerTop;
  loc_1826(m); // fills 70 tiles from there

  // Queue the game-over render task, then arm the "wait, then run the game-over sub-state"
  // pattern across the adjacent timer and sub-state cells.
  regs.de = 0x0300;
  enqueueTask(m);
  mem.write8(SUBSTATE_TIMER, GAMEOVER_WAIT);
  mem.write8(GAME_SUBSTATE, GAMEOVER_SUBSTATE);
}
