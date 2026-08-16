// SPDX-License-Identifier: GPL-3.0-only
/**
 * runIntroTimerThenInitGame — the intro / game-over entry. Redraws the GAME-OVER line, plays two
 * jingle commands, then spins the sixteen-bit intro timer down to zero. It dispatches by
 * configuration: a one-player game cold-starts; a non-player-1 turn takes the player-2 continue
 * setup; an already-seeded player-1 board pre-clears its home-bay gates; otherwise it clears the
 * tilemap, hands to the other player, seeds the single-player flags and the primary occupancy gates,
 * copies the saved player-1 work and object pages into the live pages, and resumes. Every exit reaches
 * the pace tail. LIVE-OUT: memory-only.
 */
import {
  PLAY_FLAG, ACTIVE_PLAYER, PLAYER1_SLOT, HOME_BAY1_OCCUPANCY_PRIMARY,
  OTHER_PLAYER_WORK_PAGE, OTHER_PLAYER_OBJECT_PAGE, LANE_OBJECT_INDEX, LIVE_OBJECT_PAGE,
  OBJRAM_COL3F_ATTR_SHADOW, PACE_TAIL,
} from "./names.js";
import { blitGameOverLine } from "./blitGameOverLine.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";
import { clearTilemapToTile16 } from "./clearTilemapToTile16.js";
import { handOffToOtherPlayer } from "./handOffToOtherPlayer.js";
import { clearPlayerOneHomeBayGates } from "./clearPlayerOneHomeBayGates.js";

const INTRO_TIMER = 0x83c5; // sixteen-bit intro/game-over countdown, spun to zero before dispatch
const CONTINUE_FLAG = 0x83c9;
const CONTINUE_FLAG_2P = 0x83ca; // second continue flag, the player-2 path
const COLD_START = 0x0547; // cold-start entry (still served by the frozen layer)
const PLAYER_TWO_CONTINUE = 0x04f3; // player-2 continue entry (still served by the frozen layer)
const WORK_PAGE_LEN = 0xb7;
const OBJECT_PAGE_LEN = 0x2b;

export function runIntroTimerThenInitGame(m) {
  const { mem8, mem16 } = m;

  blitGameOverLine(m);
  enqueueSoundCommand(m, 0x0c);
  enqueueSoundCommand(m, 0x0d);

  let hl = mem16[INTRO_TIMER];
  do {
    hl = (hl - 1) & 0xffff;
    mem16[INTRO_TIMER] = hl;
  } while (hl !== 0);

  if (mem8[PLAY_FLAG] === 1) return m.call(COLD_START);
  if (mem8[ACTIVE_PLAYER] !== 1) return m.call(PLAYER_TWO_CONTINUE);

  mem8[CONTINUE_FLAG] = 1;
  if (mem8[CONTINUE_FLAG_2P] !== 0) return clearPlayerOneHomeBayGates(m);

  clearTilemapToTile16(m);
  handOffToOtherPlayer(m);
  mem8[PLAY_FLAG] = 1;
  mem8[PLAYER1_SLOT] = 1;
  for (let i = 0; i < 5; i++) mem8[HOME_BAY1_OCCUPANCY_PRIMARY + i] = 0;
  for (let i = 0; i < WORK_PAGE_LEN; i++) mem8[LANE_OBJECT_INDEX + i] = mem8[OTHER_PLAYER_WORK_PAGE + i];
  for (let i = 0; i < OBJECT_PAGE_LEN; i++) mem8[LIVE_OBJECT_PAGE + i] = mem8[OTHER_PLAYER_OBJECT_PAGE + i];
  mem8[OBJRAM_COL3F_ATTR_SHADOW] = 1;
  return m.call(PACE_TAIL);
}
