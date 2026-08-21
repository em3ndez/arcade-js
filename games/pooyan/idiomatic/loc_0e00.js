// SPDX-License-Identifier: GPL-3.0-only
import { loc_0010 } from "./loc_0010.js";
import { loc_02e3 } from "./loc_02e3.js";
import {
  SPEED_INDEX,
  PLAY_STATE_INDEX,
  PLAY_TIMER_GATE_P1,
  PLAY_TIMER_GATE_P2,
  loc_89e3,
  LATCHED_ENEMY_X,
  LIVES_DSW,
  PLAYER0_LIVES,
  PLAYER1_LIVES,
  PLAYER0_STATE_BANK,
  PLAYER1_STATE_BANK,
  DIFFICULTY_DSW,
  GAME_ACTIVE_FLAG,
  LAUNCH_ARMED_FLAG,
  LAUNCH_STATE,
  loc_8f0e,
  loc_8f0f,
} from "./names.js";
/**
 * loc_0e00 — reset the actor/sprite state for a new board.
 *
 * Clears the whole live-state page and a handful of loose flags, then seeds each player's saved
 * bank from the cabinet switches — lives from the lives switch, a fixed opening X, and the sprite
 * colour from the difficulty switch — and arms the row-by-row tile fill. When the game is idle
 * (the in-play gate clear) it stops there; otherwise it also clears the launch flags.
 *
 * LIVE-OUT: A = 0 (both exits leave it zero); the memory writes are the substance.
 */
const OPENING_X = 0x20; //     initial sprite X seeded into each player's bank
const LIVE_PAGE_LEN = 0xbf; // bytes of the live-state page cleared on reset

export function loc_0e00(m) {
  const { mem8 } = m;

  loc_0010(m, SPEED_INDEX, 0, LIVE_PAGE_LEN); // clear the live-state page
  mem8[PLAY_STATE_INDEX] = 0;
  mem8[PLAY_TIMER_GATE_P1] = 0;
  mem8[PLAY_TIMER_GATE_P2] = 0;
  mem8[loc_89e3] = 0;
  mem8[LATCHED_ENEMY_X] = 0;

  const lives = mem8[LIVES_DSW];
  mem8[PLAYER0_LIVES] = lives;
  mem8[PLAYER1_LIVES] = lives;
  mem8[PLAYER0_STATE_BANK + 1] = OPENING_X;
  mem8[PLAYER1_STATE_BANK + 1] = OPENING_X;

  const colour = mem8[DIFFICULTY_DSW];
  mem8[PLAYER0_STATE_BANK] = colour;
  mem8[PLAYER1_STATE_BANK] = colour;

  loc_02e3(m); // arm the row-by-row tile fill

  if (mem8[GAME_ACTIVE_FLAG] === 0) return (m.regs.a = 0); // idle -> stop here, A cleared

  mem8[LAUNCH_ARMED_FLAG] = 0;
  mem8[LAUNCH_STATE] = 0;
  mem8[loc_8f0e] = 0;
  mem8[loc_8f0f] = 0;
  return (m.regs.a = 0);
}
