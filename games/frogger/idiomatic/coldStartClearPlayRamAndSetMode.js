// SPDX-License-Identifier: GPL-3.0-only
/**
 * coldStartClearPlayRamAndSetMode — the shared cold-start mid-entry (part 3), reached from the slot-gate
 * clears (part 1/2) and the player-1 cold board re-init. It clears the screen, runs the RAM/HW init
 * callees (credit line, score-rank pack, score header), LDIR-clears three work-RAM spans (the sprite/actor
 * block, the low object bytes, the live-object page), zeros the game-state bytes,
 * both flip latches and the difficulty-index word, sets GAME_MODE = 3 (attract score-ranking), force-
 * clears the player work RAM, then tail-transfers into the pace tail. LIVE-OUT: memory-only.
 */
import {
  SPRITE_BLOCK2_BASE, loc_8000, LIVE_OBJECT_PAGE,
  FROG_READY_FLAG, PLAY_FLAG, ATTRACT_SEQUENCER_PHASE, CONTINUE_FLAG, CONTINUE_FLAG_2P,
  FLIP_X_LATCH, FLIP_Y_LATCH, PLAYER1_DIFFICULTY_INDEX,
  ATTRACT_PHASE_COMPANION, SCREEN_FLIP_LATCH, POINT_TABLE_DRAW_STATE,
  IN_PLAY_BOARD_INIT_GUARD, INIT_GUARD_LATCH, TWO_PLAYER_START_FLAG, GAME_MODE, loc_83c4,
} from "./names.js";
import { endForegroundPassAtPaceTail } from "./endForegroundPassAtPaceTail.js";
import { clearActivePlayerWorkRam } from "./clearActivePlayerWorkRam.js";
import { forceClearPlayerWorkRam } from "./forceClearPlayerWorkRam.js";
import { clearTilemapToTile16 } from "./clearTilemapToTile16.js";
import { renderCreditLine } from "./renderCreditLine.js";
import { packScoreRankPair } from "./packScoreRankPair.js";
import { renderScoreHeader } from "./renderScoreHeader.js";
import { u16 } from "../../../core/int.js";

const GAME_MODE_SCORE_RANK = 0x03;

const PLAY_RAM_LEN = 0x160;    // sprite/actor work-RAM span
const OBJ0_LEN = 0x05;         // low object bytes span
const OBJ_PAGE_LEN = 0x2f;     // live-object page span

export function coldStartClearPlayRamAndSetMode(m) {
  const { mem8, mem16 } = m;

  clearTilemapToTile16(m);
  clearActivePlayerWorkRam(m);
  renderCreditLine(m);
  packScoreRankPair(m);
  renderScoreHeader(m);

  for (let i = 0; i < PLAY_RAM_LEN; i++) mem8[u16(SPRITE_BLOCK2_BASE + i)] = 0;
  for (let i = 0; i < OBJ0_LEN; i++) mem8[u16(loc_8000 + i)] = 0;
  for (let i = 0; i < OBJ_PAGE_LEN; i++) mem8[u16(LIVE_OBJECT_PAGE + i)] = 0;

  mem8[FROG_READY_FLAG] = 0;
  mem8[PLAY_FLAG] = 0;
  mem8[ATTRACT_SEQUENCER_PHASE] = 0;
  mem8[CONTINUE_FLAG] = 0;
  mem8[CONTINUE_FLAG_2P] = 0;
  mem8[FLIP_X_LATCH] = 0;
  mem8[FLIP_Y_LATCH] = 0;
  mem16[PLAYER1_DIFFICULTY_INDEX] = 0; // 16-bit write; also clears the player-2 difficulty index
  mem8[ATTRACT_PHASE_COMPANION] = 0;
  mem8[SCREEN_FLIP_LATCH] = 0;
  mem8[POINT_TABLE_DRAW_STATE] = 0;
  mem8[loc_83c4] = 0; // cleared at cold-start; role unknown (loc_ per names-debt, ground via MAME)
  mem8[IN_PLAY_BOARD_INIT_GUARD] = 0;
  mem8[INIT_GUARD_LATCH] = 0;
  mem8[TWO_PLAYER_START_FLAG] = 0;
  mem8[GAME_MODE] = GAME_MODE_SCORE_RANK;

  forceClearPlayerWorkRam(m);
  return endForegroundPassAtPaceTail(m);
}
