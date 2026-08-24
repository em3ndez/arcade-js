// SPDX-License-Identifier: GPL-3.0-only
import { loc_02b9 } from "./loc_02b9.js";
import {
  loc_8819,
  WATCHDOG_KICK,
  GAME_ACTIVE_FLAG,
  TILE_FILL_PTR,
  PLAYFIELD_PAINT_START,
  FILL_ROW_COUNTER,
  PLAY_STATE_INDEX,
} from "./names.js";
/**
 * loc_0c5c — board-build state 0.
 *
 * Clears the state scratch byte, kicks the watchdog, drops the in-play flag, seats the row-fill
 * cursor at the playfield paint origin, primes the row counter, advances the sub-state to 1, then
 * clears the board-init RAM regions.
 *
 * LIVE-OUT: memory only — the delegated clear seats A=0 / B=0 / HL in m.regs for the dispatcher.
 */
export function loc_0c5c(m) {
  const { mem8, mem16 } = m;
  mem8[loc_8819] = 0x00;
  mem8[WATCHDOG_KICK] = 0x00; // watchdog kick
  mem8[GAME_ACTIVE_FLAG] = 0x00;
  mem16[TILE_FILL_PTR] = PLAYFIELD_PAINT_START;
  mem8[FILL_ROW_COUNTER] = 0x0f;
  mem8[PLAY_STATE_INDEX]++; // sub-state -> 1
  loc_02b9(m); // clear the board-init RAM regions
}
