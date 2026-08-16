// SPDX-License-Identifier: GPL-3.0-only
/**
 * loadActivePlayerLaneParams — load the active player's 33-byte lane-parameter block: read the difficulty index for
 * player 1 or 2, follow the pointer table to that difficulty's block, and copy it into the
 * lane-parameter cells.
 * LIVE-OUT: memory-only.
 */
import { ACTIVE_PLAYER, PLAYER1_DIFFICULTY_INDEX, PLAYER2_DIFFICULTY_INDEX, LANE_PARAM_PTR_TABLE, ACTIVE_LANE_PARAM_BLOCK } from "./names.js";

const PLAYER_ONE = 1;
const BLOCK_SIZE = 33;
const POINTER_WIDTH = 2;

export function loadActivePlayerLaneParams(m) {
  const { mem8, mem16 } = m;
  const indexCell = mem8[ACTIVE_PLAYER] === PLAYER_ONE ? PLAYER1_DIFFICULTY_INDEX : PLAYER2_DIFFICULTY_INDEX;
  const difficulty = mem8[indexCell];
  const block = mem16[(LANE_PARAM_PTR_TABLE + POINTER_WIDTH * difficulty) & 0xffff];
  for (let i = 0; i < BLOCK_SIZE; i++) {
    mem8[(ACTIVE_LANE_PARAM_BLOCK + i) & 0xffff] = mem8[(block + i) & 0xffff];
  }
}
