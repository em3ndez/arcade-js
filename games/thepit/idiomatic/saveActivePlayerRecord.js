// SPDX-License-Identifier: GPL-3.0-only
/**
 * saveActivePlayerRecord — copy the live working game record into the backup slot of
 * the player whose turn it is, so their progress survives the turn switch.  ROM 0x4632.
 *
 * Two players alternate turns, so each keeps a private copy of their progress while
 * the other is playing. That progress is five one-byte fields — the level, two round
 * counters, and the two score bytes — and each field is stored as three consecutive
 * bytes laid out as [working, player-1 backup, player-2 backup]. Play reads and
 * updates the working byte of every field; this routine writes those live values back
 * into the current player's backup byte across all five fields. The player-index byte
 * (1 or 2) picks which backup column to write. The restore sibling does the reverse,
 * loading a player's backup back into the working bytes at the start of their turn.
 *
 * Also used at game start to prime both players' backups: the caller loads the working
 * fields with their defaults and calls this once per player.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4632.test.js.
 * GATE:     crafted-entry — 0x4632 is never dispatched in attract (its call sites sit
 *           behind branches the demo never takes), so the gate runs it from a real
 *           captured entry of its restore sibling 0x4644 (same call convention, reached
 *           in attract), sweeping the player-index byte over 1 / 2 / 0 / 3 to cover both
 *           selection arms. TEETH: a wrong-column twin and a dropped-field twin.
 * LIVE-OUT: memory-only — the five backup bytes of the selected player's record. The
 *           oracle's residual value registers and flags are dead ABI (no caller reads them).
 * NAMES:    LEVEL 0x8028 = field 0 / working-record base (the block runs through
 *           SCORE_HI 0x8034); GAME_STATE2 0x8002 = the 1/2 player-index selector.
 */

import { LEVEL, GAME_STATE2 } from "./ram.js";

export function saveActivePlayerRecord(m) {
  const { mem8 } = m;

  // Each field's three bytes are [working, player-1 backup, player-2 backup].
  // The player-index byte names the current player: its backup column is offset 1
  // for player 1, offset 2 for anyone else.
  const backupColumn = mem8[GAME_STATE2] === 1 ? 1 : 2;

  // Persist the live working value of all five fields into that player's backup
  // column, so their level, round counters, and score are preserved for their turn.
  for (let field = 0; field < 5; field++) {
    const workingByte = LEVEL + field * 3;
    mem8[workingByte + backupColumn] = mem8[workingByte];
  }
}
