// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectActivePlayerScoreBuffer — pointer to the active player's 3-byte BCD score buffer.
 *
 * Bit 0 of ACTIVE_PLAYER picks the bank: even -> player 1 (P1_SCORE_BCD), odd -> player 2
 * (P2_SCORE_BCD). Read-only; preserves the caller's A and flags.
 *
 * LIVE-OUT: the chosen buffer pointer (DE, 16-bit), returned; wiring must write it back.
 */
import { ACTIVE_PLAYER, P1_SCORE_BCD, P2_SCORE_BCD } from "./names.js";

export function selectActivePlayerScoreBuffer(m) {
  const { mem8 } = m;

  return (mem8[ACTIVE_PLAYER] & 0x01) ? P2_SCORE_BCD : P1_SCORE_BCD;
}
