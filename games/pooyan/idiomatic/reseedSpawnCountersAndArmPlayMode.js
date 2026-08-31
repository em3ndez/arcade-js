// SPDX-License-Identifier: GPL-3.0-only
import {
  SPAWN_PHASE_COUNTER,
  ROPE_DRAW_COUNT,
  ROUND_COUNTER,
  STAGE_COUNTDOWN,
  GAME_ACTIVE_FLAG,
  PLAY_MODE_LATCH,
  DISPLAY_LIST_SRC_PTR,
  LAUNCH_SCRIPT_PTR,
} from "./names.js";
import { resetBoardRamAndReseedSpawnCounters } from "./resetBoardRamAndReseedSpawnCounters.js";
import { saveLiveStateToPlayerBank } from "./saveLiveStateToPlayerBank.js";
import { fillByteRun } from "./fillByteRun.js";
import { resetGameToAttractState } from "./resetGameToAttractState.js";
/**
 * reseedSpawnCountersAndArmPlayMode — gameplay-state handler. Reseeds the spawn counters, seats the sprite attribute
 * (0x30 when the round counter is >= 2, else 0x28), and bumps the round counter. On the odd-frame
 * path it saves the live state; otherwise, with the credit gate closed it tears down; else it
 * either clears the display-list block (latch already set) or arms the play-mode latch. Every
 * non-teardown exit tails into saveLiveStateToPlayerBank, reusing this frame.
 *
 * LIVE-OUT: memory only — no register survives for a caller.
 */

export function reseedSpawnCountersAndArmPlayMode(m) {
  const { mem8 } = m;

  const a = resetBoardRamAndReseedSpawnCounters(m);
  mem8[SPAWN_PHASE_COUNTER] = a;
  mem8[ROPE_DRAW_COUNT] = a;

  mem8[STAGE_COUNTDOWN] = mem8[ROUND_COUNTER] >= 0x02 ? 0x30 : 0x28;

  mem8[ROUND_COUNTER] = mem8[ROUND_COUNTER] + 1; // bump phase counter
  if (mem8[ROUND_COUNTER] & 0x01) return saveLiveStateToPlayerBank(m, 0x89); // odd frame

  if (mem8[GAME_ACTIVE_FLAG] === 0) return resetGameToAttractState(m); // credit gate closed

  if (mem8[PLAY_MODE_LATCH] !== 0) {
    fillByteRun(m, DISPLAY_LIST_SRC_PTR, 0x00, 0x10); // latch set: clear the block
    return saveLiveStateToPlayerBank(m, 0x81);
  }

  mem8[ROUND_COUNTER] = mem8[ROUND_COUNTER] - 1; // undo the bump
  mem8[PLAY_MODE_LATCH] = 0x01;
  mem8[STAGE_COUNTDOWN] = 0x01;
  mem8[LAUNCH_SCRIPT_PTR] = 0x40;
  return saveLiveStateToPlayerBank(m, 0x89);
}
