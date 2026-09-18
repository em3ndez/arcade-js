// SPDX-License-Identifier: GPL-3.0-only
/**
 * saveActivePlayerRecord — copy the live working game record into the backup slot of the
 * player whose turn it is, so their progress survives the turn switch.
 *
 * Two players alternate turns, so each keeps a private copy of progress while the other plays.
 * That progress is five one-byte fields — the level, two round counters, and the two score
 * bytes — each stored as three bytes: [working, player-1 backup, player-2 backup]. This writes
 * every field's live working value into the current player's backup column (the restore sibling
 * does the reverse at turn start); it also primes both players' backups at game start.
 */

import { LEVEL, ACTIVE_PLAYER } from "./names.js";

export function saveActivePlayerRecord(m) {
  const { mem8 } = m;

  // ACTIVE_PLAYER selects the backup column — offset 1 for player 1, offset 2 for anyone else.
  const backupColumn = mem8[ACTIVE_PLAYER] === 1 ? 1 : 2;

  // Persist every field's live working value into that player's backup column.
  for (let field = 0; field < 5; field++) {
    const workingByte = LEVEL + field * 3;
    mem8[workingByte + backupColumn] = mem8[workingByte];
  }
}
