// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectActivePlayerScoreBuffer — return a pointer to the active player's score buffer.
 *
 * ROM 0x04f2-0x0500. Grounding: [seen].
 *
 * In a two-player game the machine keeps a separate score for each player, each held as a
 * 3-byte packed-BCD (binary-coded-decimal) buffer: P1_SCORE_BCD for player 1, P2_SCORE_BCD for
 * player 2. Whose turn it is right now is recorded in ACTIVE_PLAYER. Any routine that adds
 * points or draws the score calls this first to learn which of the two buffers to work on.
 *
 * The selector is bit 0 of ACTIVE_PLAYER: an EVEN value means player 1, an ODD value means
 * player 2. (The ROM does this by rotating that bit into the carry flag and branching on it;
 * the low-bit test here is the same decision.)
 *
 * Read-only: it inspects ACTIVE_PLAYER and writes no memory. The ROM also saves and restores
 * the accumulator and flags around the check, so the caller's A and flags come back untouched —
 * this routine only produces the pointer.
 *
 * LIVE-OUT: the chosen buffer pointer, returned (the machine leaves it in DE). Wiring must
 * carry it back to the caller.
 */
import { ACTIVE_PLAYER, P1_SCORE_BCD, P2_SCORE_BCD } from "./names.js";

export function selectActivePlayerScoreBuffer(m) {
  const { mem8 } = m;

  // Bit 0 of ACTIVE_PLAYER picks the buffer: set (odd) -> player 2, clear (even) -> player 1.
  return (m.regs.de = (mem8[ACTIVE_PLAYER] & 0x01) ? P2_SCORE_BCD : P1_SCORE_BCD);
}
