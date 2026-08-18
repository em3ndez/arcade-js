// SPDX-License-Identifier: GPL-3.0-only
/**
 * initNewGameScoreAndTimers  —  ROM 0x0b0a  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The per-game reset for the scoring and timing HUD cells. It wipes the two players' running scores,
 *   re-arms the once-per-game extra-life award, and fills both players' time bars back up to the
 *   configured starting time — the "fresh slate" every new game starts from.
 *
 * WHERE IT SITS
 *   Called exactly once per game, from startNewGame (the one-time seed that runs when a coin-in start is
 *   accepted). startNewGame has already deducted the credit, set the player count, cleared the play RAM,
 *   and marked the game live; this routine is the piece that zeroes the scoreboard and refills the timers
 *   before the first board is laid. It runs at game start only — the per-frame timer *drain* lives
 *   elsewhere (renderFrogSceneAndTickTimer, 0x0942), and the per-frame HUD redraw in renderScoreHeader
 *   (0x0b1f) and renderTimeBar (0x0a16).
 *
 * LIVE-OUT
 *   Memory only. It writes three 16-bit RAM cells and reads one byte; it returns nothing and leaves no
 *   register the caller reads. Note what it deliberately does NOT touch: HIGH_SCORE (0x83ef) is left
 *   alone, so the machine's best score survives across games.
 */
import { SHARED_TIME_BYTE, TIME_REMAINING_P1, PLAYER1_EXTRA_LIFE_AWARDED, PLAYER2_SCORE, PLAYER1_SCORE } from "./names.js";

export function initNewGameScoreAndTimers(m) {
  const { mem8, mem16 } = m;

  // ── Zero both players' running scores ────────────────────────────────────────────────
  // PLAYER1_SCORE (0x83ed) and PLAYER2_SCORE (0x83eb) are the two 16-bit BCD score words the machine
  // adds points into during play (addScoreAndAwardExtraLife, 0x08e0) and renderScoreHeader (0x0b1f)
  // draws in the 1-UP / 2-UP columns. A new game starts both players from 0. These are separate words at
  // separate addresses, so each needs its own 16-bit clear. (The persistent HIGH_SCORE at 0x83ef is a
  // different cell and is intentionally left untouched.)
  mem16[PLAYER1_SCORE] = 0;
  mem16[PLAYER2_SCORE] = 0;

  // ── Re-arm the extra-life award for both players ─────────────────────────────────────
  // PLAYER1_EXTRA_LIFE_AWARDED (0x83e7) and PLAYER2_EXTRA_LIFE_AWARDED (0x83e8) are an ADJACENT one-byte
  // pair — the one-time latches addScoreAndAwardExtraLife sets the first frame a player's score reaches
  // the 20000-point threshold, so the award fires only once per game. One 16-bit write at 0x83e7 clears
  // both bytes at once (low byte -> 0x83e7, high byte -> 0x83e8), re-arming the award for the fresh game.
  mem16[PLAYER1_EXTRA_LIFE_AWARDED] = 0;

  // ── Refill both time bars to the configured starting time ────────────────────────────
  // SHARED_TIME_BYTE (0x83e4) holds the starting-time value seeded at cold boot from the difficulty DSW
  // table (STARTING_TIME_DSW_TABLE, 0x2e00) — the full length of a fresh timer. Copy it into BOTH
  // per-player time-remaining bytes so each player's bar begins full: TIME_REMAINING_P1 (0x83e5) is the
  // low byte and TIME_REMAINING_P2 (0x83e6) is the adjacent high byte, so a single 16-bit write at 0x83e5
  // covers the pair. Duplicating startTime into both halves of the word makes both bytes equal to it. (In
  // the Z80 original this is the LD A,(0x83e4) / LD H,A / LD L,A / LD (0x83e5),HL idiom.) These bytes are
  // what renderTimeBar (0x0a16) draws as the timer column and renderFrogSceneAndTickTimer (0x0942) drains
  // one per frame during play.
  const startTime = mem8[SHARED_TIME_BYTE];
  mem16[TIME_REMAINING_P1] = (startTime << 8) | startTime;
}
