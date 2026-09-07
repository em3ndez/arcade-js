// SPDX-License-Identifier: GPL-3.0-only
//
// selectCurrentPlayerScore — resolve a pointer to the active player's score field.
//
// WHAT IT IS
//   A pure selector: reads CURRENT_PLAYER (0x400d) and returns, in DE, the base address of that
//   player's 3-byte packed-BCD score field — PLAYER1_SCORE_BCD (0x40a2) for player 1 (index 0),
//   PLAYER2_SCORE_BCD (0x40a5) otherwise. It reads that one flag and writes no memory.
//
// ROLE IN THE MACHINE
//   Score add/display routines call this to point at "the current player's score" without caring
//   which player is up; the two fields are three contiguous BCD bytes each. DE is the Z80 return
//   convention here (the caller consumes m.regs.de).
//
// ROM 0x2290.  Grounding: [seen].
// LIVE-OUT: m.regs.de = the selected score field's base address.
import { CURRENT_PLAYER, PLAYER1_SCORE_BCD, PLAYER2_SCORE_BCD } from "./names.js";

export function selectCurrentPlayerScore(m) {
  const { mem8 } = m;

  // Player 1 is 0, player 2 is any nonzero value; return DE = the matching score field's base.
  const scorePtr = mem8[CURRENT_PLAYER] === 0 ? PLAYER1_SCORE_BCD : PLAYER2_SCORE_BCD;
  return (m.regs.de = scorePtr);
}
