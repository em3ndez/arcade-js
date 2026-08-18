// SPDX-License-Identifier: GPL-3.0-only
/**
 * setUpPlayerTwoContinue — the player-2 continue setup. Marks the second continue flag, and if the
 * first continue flag is already set calls the cold-start alternate-slot-gate clear (which falls into
 * the shared cold-start mid-entry). Otherwise it clears the
 * tilemap, hands play to the other player, seeds the single-player flags and the alternate-bank
 * occupancy gates, copies the saved player-2 object and work pages into the live pages, sets the
 * per-column attribute shadow, and resumes at the pace tail. LIVE-OUT: memory-only.
 */
import {
  PLAY_FLAG, LIVE_OBJECT_PAGE, LANE_OBJECT_INDEX, OBJRAM_COL3F_ATTR_SHADOW,
  HOME_BAY1_OCCUPANCY_ALT, OBJECT_PAGE_SAVE_BANK, WORK_PAGE_SAVE_BANK,
  PLAYER2_SLOT,
  CONTINUE_FLAG, CONTINUE_FLAG_2P,
} from "./names.js";
import { endForegroundPassAtPaceTail } from "./endForegroundPassAtPaceTail.js";
import { coldStartClearAltSlotGates } from "./coldStartClearAltSlotGates.js";
import { clearTilemapToTile16 } from "./clearTilemapToTile16.js";
import { handOffToOtherPlayer } from "./handOffToOtherPlayer.js";

const WORK_PAGE_LEN = 0xb7;
const OBJECT_PAGE_LEN = 0x2b;

export function setUpPlayerTwoContinue(m) {
  const { mem8 } = m;

  mem8[CONTINUE_FLAG_2P] = 1;
  if (mem8[CONTINUE_FLAG] !== 0) return coldStartClearAltSlotGates(m);

  clearTilemapToTile16(m);
  handOffToOtherPlayer(m);
  mem8[PLAY_FLAG] = 1;
  mem8[PLAYER2_SLOT] = 1;
  for (let i = 0; i < 5; i++) mem8[HOME_BAY1_OCCUPANCY_ALT + i] = 0;
  for (let i = 0; i < OBJECT_PAGE_LEN; i++) mem8[LIVE_OBJECT_PAGE + i] = mem8[OBJECT_PAGE_SAVE_BANK + i];
  mem8[OBJRAM_COL3F_ATTR_SHADOW] = 1;
  for (let i = 0; i < WORK_PAGE_LEN; i++) mem8[LANE_OBJECT_INDEX + i] = mem8[WORK_PAGE_SAVE_BANK + i];
  return endForegroundPassAtPaceTail(m);
}
