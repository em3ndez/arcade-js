// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectPlayer2AndComposeScreen — make player 2 the current player, then compose
 * this player's screen.  ROM 0x144F.
 *
 * One of the two active-player arms of the sub-state-0x14 handler loc_141E (ROM
 * 0x141E), which — at game over (GAME_STATE 3, GAME_SUBSTATE 0x14) — scans the five
 * 0x611C object records for an active player slot. loc_141E first clears its two-byte
 * "player index" (CURRENT_PLAYER 0x600D and its companion 0x600E) to 0, then:
 *   - a record == 1  ->  jumps straight into the compose tail with A = 0x01, leaving
 *                        the player index at 0 (player 1 stays up);
 *   - a record == 3  ->  jumps HERE, which sets the player index to 1 (player 2 is up)
 *                        and enters the compose tail with A = 0x00.
 * So this routine's own contribution is exactly "select player 2"; everything after is
 * the shared compose tail it delegates to.
 *
 * It does two things, then delegates:
 *   1. SELECT PLAYER 2. Write 1 to both bytes of loc_141E's player index. The confirmed
 *      half, CURRENT_PLAYER (0x600D) == 1, is what makes player 2 the current player
 *      (score awards, context slot, etc. all key off it). 0x600E is written in lockstep
 *      (loc_141E cleared both, each arm rewrites both).
 *   2. COMPOSE with A = 0. Enter configureFlipScreenAndComposeScreen (ROM 0x1459) with
 *      the player key A = 0: that routine sets the flip-screen latch to (A | DIP_UPRIGHT),
 *      so A = 0 lets the cabinet DIP alone decide flip (the record==1 arm instead forces
 *      flip on with A = 1). It then clears the sub-state timer, advances GAME_SUBSTATE,
 *      and posts the twelve screen-draw tasks.
 *
 * A is passed to the callee through the register file (the callee reads regs.a), exactly
 * as the oracle's `ld a,0x00` did — not a stack push, just the callee's live-in.
 *
 * Memory-equivalent to the frozen oracle — equivalence-144f.test.js.
 * GATE:     crafted-entry — loc_144F is NOT reached in attract or a 1-player coin+start
 *           run (its parent loc_141E's record scan finds no active slot and takes the
 *           record-neither -> loc_1475 arm). The real entry is forced from a genuine
 *           loc_141E dispatch (at game over) by a single-byte upstream nudge — poking one
 *           0x611C record to 3 — so the ROM's own loc_141E -> loc_144F dispatch mints the
 *           entry. Fresh clone per case; RAM (ex-STACK_SCRATCH) + the 0x7D82 flip latch
 *           compared. A crafted DIP matrix covers flip = A(0)|DIP over DIP in {0,1}.
 * LIVE-OUT: memory + the 0x7D82 flip-screen latch. Memory: CURRENT_PLAYER (0x600D) and its
 *           companion 0x600E set to 1, plus (via the callee) SUBSTATE_TIMER (0x6009),
 *           GAME_SUBSTATE (0x600A), and the task ring + TASK_TAIL. The flip latch is a board
 *           io output, outside the RAM dump (compared via io.flipScreen). No live
 *           registers/flags — loc_144F tail-returns up the rst-0x28 NMI dispatch path
 *           (loc_141E does `return m.call(0x144F)`), which consumes none; the oracle's
 *           residual A and the callee's DE/B/HL/F are dead ABI. SP/pc are the dropped stack
 *           model — the oracle's per-post push/ret residue lands only in STACK_SCRATCH.
 * NAMES:    CURRENT_PLAYER (0x600D) from ram.js; imports configureFlipScreenAndComposeScreen
 *           (the idiomatic ROM 0x1459 callee). 0x600E is CURRENT_PLAYER's companion in
 *           loc_141E's player-index pair but is unnamed in ram.js (only its confirmed half
 *           is named), so it stays a local hex constant, not an invented name.
 */

import { CURRENT_PLAYER } from "./ram.js";
import { configureFlipScreenAndComposeScreen } from "./configureFlipScreenAndComposeScreen.js";

// Companion byte to CURRENT_PLAYER (0x600D). loc_141E treats 0x600D:0x600E as one
// "player index": it clears BOTH to 0 up front, and each active-player arm rewrites
// BOTH to the same value. 0x600E is unnamed in ram.js (only CURRENT_PLAYER, its
// confirmed half, is named), so it stays a local hex constant rather than an invented name.
const PLAYER_INDEX_COMPANION = 0x600e;

export function selectPlayer2AndComposeScreen(m) {
  const { regs, mem } = m;

  // 1. Select player 2: write 1 to both bytes of loc_141E's player index. The record==1
  //    arm leaves them at the 0 loc_141E cleared them to (player 1 up); this record==3
  //    arm sets them to 1 (CURRENT_PLAYER == 1 means player 2 is up).
  mem.write8(PLAYER_INDEX_COMPANION, 0x01);
  mem.write8(CURRENT_PLAYER, 0x01);

  // 2. Compose this player's screen with the player key A = 0. The callee reads regs.a to
  //    build the flip-screen latch (A | DIP_UPRIGHT); A = 0 lets the cabinet DIP alone
  //    decide flip. It also clears the sub-state timer, advances GAME_SUBSTATE, and posts
  //    the twelve screen-draw tasks.
  regs.a = 0x00;
  configureFlipScreenAndComposeScreen(m);
}
