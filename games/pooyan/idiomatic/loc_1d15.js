// SPDX-License-Identifier: GPL-3.0-only
import { loc_0010 } from "./loc_0010.js";
import { loc_1d0d } from "./loc_1d0d.js";
import { loc_1ce7 } from "./loc_1ce7.js";
import { loc_1d3c } from "./loc_1d3c.js";
import {
  SPEED_INDEX,
  TWO_PLAYER_FLAG,
  CREDIT_COUNT,
  GAME_ACTIVE_FLAG,
  PLAY_STATE_INDEX,
  FLIP_SCREEN_FLAG,
  MAIN_GAME_STATE,
} from "./names.js";
/**
 * loc_1d15 — full-clear tail of the play-state dispatch handler.
 *
 * Zero-fills the live actor page, then reseeds one player through the sprite-slot body: the two-player
 * flag picks the fixed-stride paint or the cap-first stamp (exactly one runs — the picked branch leaves
 * the decision flag intact). With no credit left it delegates to the cold teardown; otherwise it
 * finishes the player-continue path (clear the active gate and sub-state, arm flip and the continue
 * state) and returns.
 *
 * LIVE-OUT: none — a void handler.
 */

const PAGE_LEN = 0xbf;
const CONTINUE_STATE = 2;

export function loc_1d15(m) {
  const { mem8 } = m;

  loc_0010(m, SPEED_INDEX, 0, PAGE_LEN); // zero-fill the live actor page

  if (mem8[TWO_PLAYER_FLAG] === 0) loc_1d0d(m); // fixed-stride paint
  else loc_1ce7(m); // cap-first column stamp

  if (mem8[CREDIT_COUNT] === 0) return loc_1d3c(m); // no credit -> cold teardown

  mem8[GAME_ACTIVE_FLAG] = 0;
  mem8[PLAY_STATE_INDEX] = 0;
  mem8[FLIP_SCREEN_FLAG] = 1;
  mem8[MAIN_GAME_STATE] = CONTINUE_STATE;
}
