// SPDX-License-Identifier: GPL-3.0-only
/**
 * losePlayer1Life — spend one of player 1's lives, snapshot their context, then route
 * to the resume interlude or the game-over sequence.  ROM 0x12f2.
 *
 * The in-game sub-state handler for index 0x0E ("P1 death"), dispatched by
 * dispatchInGameSubstate once Mario's death animation has run. It does the death
 * book-keeping for PLAYER 1 (its twin loc_1344 is the identical handler for player 2,
 * hardwired to the P2 slots instead) in a fixed order:
 *
 *   1. Silence every sound (silenceSound).
 *   2. Clear PLAY_INTRO so the next life skips the opening Kong-climb cutscene.
 *   3. Decrement LIVES in place — one life spent.
 *   4. Snapshot the live 8-byte player context (LIVES..HOW_HIGH_LAST_SEQ,
 *      0x6228-0x622F) back into player 1's save slot P1_CONTEXT (0x6040), which the
 *      next turn restores. The clear (2) and decrement (3) happen BEFORE this copy, so
 *      the saved slot carries the post-death life count and the cleared intro flag.
 *   5. Branch on the remaining life count:
 *      - lives left  -> set GAME_SUBSTATE to the resume interlude: 0x08 in a
 *        1-player game, 0x17 in a 2-player game (the player-alternation screen).
 *      - none left   -> player 1's game is over: format the final score for display /
 *        ranking (loc_13ca with player 1's score slot), stamp the game-over banner
 *        across VRAM (loc_1826, 70 tiles), queue the render task(s), and arm the
 *        "wait 0xC0 frames then run sub-state 0x10" idiom (SUBSTATE_TIMER + the
 *        adjacent GAME_SUBSTATE). In a 2-player game the banner starts one column left
 *        and an extra render task is queued first.
 *
 * Memory-equivalent to the frozen oracle — equivalence-12f2.test.js.
 * GATE:     crafted-entry — 0x12f2 is a game-state-3 sub-state handler (needs a
 *           credited game and a P1 death) and is never dispatched in plain attract, so
 *           it cannot be captured there. A real attract-base machine is poked to each
 *           arm identically on both sides: lives-remain (1P -> 0x08, 2P -> 0x17) and
 *           game-over (1P and 2P, with ATTRACT=0 running loc_13ca's full body and
 *           ATTRACT=1 exercising its early-abort sub-path). Full oracle run both sides,
 *           RAM (ex-STACK_SCRATCH) diff; teeth = wrong-resume-routing, skipped-life-
 *           decrement, and wrong-game-over-sub-state twins.
 * LIVE-OUT: memory-only — reached via the sub-state dispatch (dispatchInGameSubstate ->
 *           dispatchGameState), which consumes no register or flag this routine leaves;
 *           it sets the NEXT frame's GAME_SUBSTATE and the rest is RAM. pc/SP are the
 *           dropped stack model (the oracle's terminal `ret` becomes the JS return, and
 *           the raw loc_1826 callee's own `ret` is a harmless read-only stack pop).
 * NAMES:    PLAY_INTRO (0x622C), LIVES (0x6228), P1_CONTEXT (0x6040), TWO_PLAYER_GAME
 *           (0x600F), P1_SCORE (0x60B2), GAME_SUBSTATE (0x600A), SUBSTATE_TIMER
 *           (0x6009) from ram.js. Kept hex: the game-over banner VRAM origin 0x76D4
 *           (video RAM, not work RAM) and the literal sub-state / timer / task-payload
 *           constants.
 */

import { silenceSound } from "./silenceSound.js"; // ROM 0x011C
import { loc_13ca } from "./loc_13ca.js"; // ROM 0x13CA
import { enqueueTask } from "./enqueueTask.js"; // ROM 0x309F
// ROM 0x1826 — 70-tile VRAM fill. The FROZEN ORACLE deliberately: an idiomatic twin
// (fillTileBlock.js) exists and 0x1826 is in ram.js's ROUTINES, so "no idiomatic yet" is FALSE.
// The oracle is a pure leaf ending in `ret` and consumes one guest-stack word the twin's JS
// return does not. Left because nothing can prove the swap safe: no run reaches this call site,
// and the injected 2-byte delta was caught by neither this routine's equivalence gate nor the
// full-flip gate. Same call, same reasoning, as the one in loc_1880.js.
import { loc_1826 } from "../translated/loc_1826.js";
import {
  PLAY_INTRO,
  LIVES,
  P1_CONTEXT,
  TWO_PLAYER_GAME,
  P1_SCORE,
  GAME_SUBSTATE,
  SUBSTATE_TIMER,
} from "./ram.js";

const CONTEXT_BYTES = 8; // the live player-context block 0x6228-0x622F saved to P1_CONTEXT

const RESUME_SUBSTATE_1P = 0x08; // lives remain, 1-player -> the resume/how-high interlude
const RESUME_SUBSTATE_2P = 0x17; // lives remain, 2-player -> the player-alternation screen

const GAMEOVER_SUBSTATE = 0x10; // no lives left -> the game-over display sequence
const GAMEOVER_WAIT = 0xc0; //     SUBSTATE_TIMER hold (~192 frames) before that sequence runs

const SCORE_FORMAT_P1 = 0x01; //   loc_13ca's A parameter selecting player 1's score slot
const BANNER_VRAM_TOP = 0x76d4; // video-RAM origin loc_1826 fills the game-over banner from

export function losePlayer1Life(m) {
  const { regs, mem } = m;

  // 1. Silence the sound hardware as the life ends.
  silenceSound(m); // ROM 0x011C

  // 2-3. Skip the next life's intro cutscene, then spend one life. Both happen before
  // the snapshot so the saved slot reflects the post-death state.
  mem.write8(PLAY_INTRO, 0);
  mem.write8(LIVES, (mem.read8(LIVES) - 1) & 0xff);
  const remaining = mem.read8(LIVES);

  // 4. Snapshot the live 8-byte context back into player 1's save slot (the `ldir`;
  // source 0x6228 and dest 0x6040 do not overlap, so a plain forward copy is faithful).
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

  // Format player 1's final score into the display / ranking staging area.
  regs.a = SCORE_FORMAT_P1;
  regs.hl = P1_SCORE;
  loc_13ca(m); // ROM 0x13CA

  // Stamp the game-over banner across VRAM. In a 2-player game the banner starts one
  // column left (0x76D3) and an extra render task [0x03,0x02] is queued first; a
  // 1-player game starts at 0x76D4 with no extra task.
  let bannerTop = BANNER_VRAM_TOP;
  if (mem.read8(TWO_PLAYER_GAME) !== 0) {
    regs.de = 0x0302;
    enqueueTask(m); // ROM 0x309F
    bannerTop = (BANNER_VRAM_TOP - 1) & 0xffff;
  }
  regs.hl = bannerTop;
  loc_1826(m); // ROM 0x1826 — fills 70 tiles of 0x10 from HL

  // Queue the game-over render task, then arm the "wait GAMEOVER_WAIT frames, then run
  // sub-state 0x10" idiom across the adjacent SUBSTATE_TIMER / GAME_SUBSTATE pair.
  regs.de = 0x0300;
  enqueueTask(m); // ROM 0x309F
  mem.write8(SUBSTATE_TIMER, GAMEOVER_WAIT);
  mem.write8(GAME_SUBSTATE, GAMEOVER_SUBSTATE);
}
