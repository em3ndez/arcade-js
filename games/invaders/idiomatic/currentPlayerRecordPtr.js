// SPDX-License-Identifier: GPL-3.0-only
import { ACTIVE_PLAYER_PAGE, PLAYER1_OBJ_DESC, PLAYER2_OBJ_DESC } from "./names.js";

/**
 * currentPlayerRecordPtr — resolve the active player's score/object descriptor pointer.
 *
 * WHAT IT IS
 *   Returns the fixed descriptor address of whichever player is currently on the machine: player 1's
 *   record PLAYER1_OBJ_DESC (0x20f8) or player 2's PLAYER2_OBJ_DESC (0x20fc). Those descriptors hold
 *   each player's BCD score total and its on-screen draw address.
 *
 * ROLE IN THE MACHINE
 *   ACTIVE_PLAYER_PAGE (0x2067) names both the current player's RAM page and, in its low bit, which
 *   player it is: bit 0 set means player 1, clear means player 2 (the ROM rotates bit 0 into carry).
 *   Unlike the page-base helpers (activePlayerPageBase / activeFieldRecordPointer) that form a
 *   0x21xx/0x22xx pointer, this maps the same selector onto the two fixed 0x20fx descriptor cells.
 *   Callers include applyPendingScoreAdd (folds the pending score into the active record) and
 *   selectAlienShotRate (reads the field-size key from the descriptor's second byte).
 *
 * ROM 0x09ca-...  Grounding: [seen].
 *
 * LIVE-OUT: HL = the selected descriptor address (also returned).
 */
export function currentPlayerRecordPtr(m) {
  // Test bit 0 of the active-player page byte: set -> player 1's descriptor, clear -> player 2's.
  return (m.regs.hl = (m.mem8[ACTIVE_PLAYER_PAGE] & 1) ? PLAYER1_OBJ_DESC : PLAYER2_OBJ_DESC);
}
