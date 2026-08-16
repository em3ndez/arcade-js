// SPDX-License-Identifier: GPL-3.0-only
/**
 * setUpPlayerTwoContinue — the player-2 continue setup. Marks the second continue flag, and if the
 * first continue flag is already set jumps to the shared cold-start mid-entry. Otherwise it clears the
 * tilemap, hands play to the other player, seeds the single-player flags and the alternate-bank
 * occupancy gates, copies the saved player-2 object and work pages into the live pages, sets the
 * per-column attribute shadow, and resumes at the pace tail. LIVE-OUT: memory-only.
 */
import {
  PLAY_FLAG, LIVE_OBJECT_PAGE, LANE_OBJECT_INDEX, OBJRAM_COL3F_ATTR_SHADOW,
  loc_8263, loc_86c0, loc_8500, PACE_TAIL,
} from "./names.js";
import { clearTilemapToTile16 } from "./clearTilemapToTile16.js";
import { handOffToOtherPlayer } from "./handOffToOtherPlayer.js";

const CONTINUE_FLAG = 0x83c9;
const CONTINUE_FLAG_2P = 0x83ca;
const PLAYER2_SLOT = 0x825d; // alternate-bank slot byte
const COLD_START_MID = 0x0557; // shared cold-start mid-entry (still served by the frozen layer)
const WORK_PAGE_LEN = 0xb7;
const OBJECT_PAGE_LEN = 0x2b;

export function setUpPlayerTwoContinue(m) {
  const { mem8 } = m;

  mem8[CONTINUE_FLAG_2P] = 1;
  if (mem8[CONTINUE_FLAG] !== 0) return m.call(COLD_START_MID);

  clearTilemapToTile16(m);
  handOffToOtherPlayer(m);
  mem8[PLAY_FLAG] = 1;
  mem8[PLAYER2_SLOT] = 1;
  for (let i = 0; i < 5; i++) mem8[loc_8263 + i] = 0;
  for (let i = 0; i < OBJECT_PAGE_LEN; i++) mem8[LIVE_OBJECT_PAGE + i] = mem8[loc_86c0 + i];
  mem8[OBJRAM_COL3F_ATTR_SHADOW] = 1;
  for (let i = 0; i < WORK_PAGE_LEN; i++) mem8[LANE_OBJECT_INDEX + i] = mem8[loc_8500 + i];
  return m.call(PACE_TAIL);
}
