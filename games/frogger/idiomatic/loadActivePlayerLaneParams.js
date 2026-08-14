// SPDX-License-Identifier: GPL-3.0-only
/**
 * loadActivePlayerLaneParams — load the active player's 33-byte lane-parameter block: read the difficulty index for
 * player 1 or 2, follow the pointer table to that difficulty's block, and copy it into the
 * lane-parameter cells.
 * LIVE-OUT: memory-only.
 */
import { loc_83fd, loc_8293, loc_8294, loc_2260, loc_8270 } from "./names.js";

const PLAYER_ONE = 1;
const BLOCK_SIZE = 33;
const POINTER_WIDTH = 2;

export function loadActivePlayerLaneParams(m) {
  const { mem8, mem16 } = m;
  const indexCell = mem8[loc_83fd] === PLAYER_ONE ? loc_8293 : loc_8294;
  const difficulty = mem8[indexCell];
  const block = mem16[(loc_2260 + POINTER_WIDTH * difficulty) & 0xffff];
  for (let i = 0; i < BLOCK_SIZE; i++) {
    mem8[(loc_8270 + i) & 0xffff] = mem8[(block + i) & 0xffff];
  }
}
