// SPDX-License-Identifier: GPL-3.0-only
// State-handler slot: tick the dwell timer; until it expires, do nothing. On expiry, reset the sequence
// and player cells, pick the next game state (3), snapshot the flag bits into the saved block, and copy
// the 8-byte companion block right after them.
import { packFlagBytesToBitmask } from "./packFlagBytesToBitmask.js";
import {
  loc_4009, SEQUENCE_STATE, CURRENT_PLAYER, GAME_STATE,
  SAVED_STATE_SNAPSHOT, loc_4218,
} from "./names.js";

const COMPANION_BYTES = 8;

export function saveFlagsToSnapshotAndSwitchPlayerState(m) {
  const { mem8 } = m;

  // Tick the dwell timer; still counting -> nothing to do.
  const remaining = (mem8[loc_4009] - 1) & 0xff;
  mem8[loc_4009] = remaining;
  if (remaining !== 0) return;

  // Expired: reset the sequence/player cells and pick the next game state.
  mem8[SEQUENCE_STATE] = 0;
  mem8[CURRENT_PLAYER] = 0;
  mem8[GAME_STATE] = 3;

  // Snapshot the packed flag bits, then append the companion block right after them.
  const after = packFlagBytesToBitmask(m, SAVED_STATE_SNAPSHOT);
  for (let i = 0; i < COMPANION_BYTES; i++) mem8[after + i] = mem8[loc_4218 + i];
}
