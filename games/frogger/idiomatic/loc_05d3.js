// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_05d3 — set the 2-player / demo start flags to their fixed initial constants.
 * LIVE-OUT: memory-only.
 */
import { BOARD_ADVANCE_REQUEST, PLAYER_START_DEMO_FLAG, FROG_STATE_DEMO_FLAG, TWO_PLAYER_START_FLAG, BOARD_LAYOUT_GATE, HOME_REVEAL_COUNTDOWN, HOME_REVEAL_DELAY_TIMER } from "./names.js";

export function loc_05d3(m) {
  const { mem8 } = m;
  mem8[BOARD_ADVANCE_REQUEST] = 1;
  mem8[PLAYER_START_DEMO_FLAG] = 1;
  mem8[FROG_STATE_DEMO_FLAG] = 1;
  mem8[TWO_PLAYER_START_FLAG] = 0;
  mem8[BOARD_LAYOUT_GATE] = 0;
  mem8[HOME_REVEAL_COUNTDOWN] = 255;
  mem8[HOME_REVEAL_DELAY_TIMER] = 64;
}
