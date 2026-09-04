// SPDX-License-Identifier: GPL-3.0-only
import { drawLivesDigit } from "./drawLivesDigit.js";
import { activePlayerFlagPtr } from "./activePlayerFlagPtr.js";
import { currentPlayerRecordPtr } from "./currentPlayerRecordPtr.js";
import { drawHighScore } from "./drawHighScore.js";
import { typePacedSpriteRun } from "./typePacedSpriteRun.js";
import { drawSprite8x8 } from "./drawSprite8x8.js";
import { waitShortDelay } from "./waitShortDelay.js";
import { otherPlayerFlagPtr } from "./otherPlayerFlagPtr.js";
import { returnToAttractFlow } from "./returnToAttractFlow.js";
import { newRoundFlow } from "./newRoundFlow.js";
import { ACTIVE_PLAYER_PAGE, TWO_PLAYER_GAME, HIGH_SCORE_OBJ_DESC, GAME_OVER_TEXT, GAME_OVER_BANNER_SCREEN_ADDR, GAMEOVER_PLAYER_NUM_SCREEN_ADDR } from "./names.js";

/**
 * gameOverFlow (ROM 0x166d -> 0x1671) -- the active player's game-over sequence.
 *
 * WHAT IT IS
 *   Runs when the active player has lost their last ship (armed as a successor frame flow: playerShipHandler
 *   sets m.nextMain to this on the final-life drain, and invasionReset tails into it after the fleet reaches
 *   the bottom). It stands the player down, promotes their score to the high score if it beat it, and then
 *   branches on game mode: a one-player game (or a two-player game with both players out) returns to the
 *   attract loop; a two-player game with a survivor types the game-over banner + this player's number and
 *   hands the turn to the other player.
 *
 * ROLE IN THE MACHINE
 *   One of the three round-restart flows in the in-game spine (alongside newRoundFlow and doJFlow); see
 *   mechanisms.md "The in-game main loop and round restarts". Reads/writes: the lives digit (drawLivesDigit),
 *   this player's in-progress flag (activePlayerFlagPtr -> loc_20e7-relative), the active player's score in
 *   its object record (currentPlayerRecordPtr, a two-byte BCD value at rec+0/rec+1), the shared high-score
 *   record HIGH_SCORE_OBJ_DESC (0x20f4/0x20f5), the mode byte TWO_PLAYER_GAME (0x20ce), the active-player
 *   selector ACTIVE_PLAYER_PAGE (0x2067), and the other player's remaining-lives flag (otherPlayerFlagPtr).
 *   Exits by yielding into returnToAttractFlow (attract teardown) or newRoundFlow (hand to the survivor).
 *
 * Grounding: spine flow -- no per-routine cert in names.js ROUTINES; behaviour described in mechanisms.md
 *   "The in-game main loop and round restarts". Its constituent leaf routines (drawLivesDigit, drawHighScore,
 *   drawSprite8x8, typePacedSpriteRun, ...) are each [seen].
 *
 * LIVE-OUT: none for callers -- it is a terminal frame flow that hands control to another flow. Generator;
 *   memory + IO (yields pace the two-player banner + delay).
 */
export function* gameOverFlow(m) {
  // Stand the player down: blank the on-screen lives digit and clear THIS player's in-progress flag
  // (activePlayerFlagPtr resolves loc_20e7 + the active-player bit) so the mode branch below and the
  // survivor check see this player as out.
  drawLivesDigit(m, 0x00);
  m.mem8[activePlayerFlagPtr(m)] = 0x00;

  // High-score promotion via a 16-bit compare, high byte first (mirrors the 8080 cmp/jnz sequence).
  // The player's score is a two-byte BCD value at the start of its object record (rec+0 = low, rec+1 = hi);
  // HIGH_SCORE_OBJ_DESC holds the current high score the same way. Compare the high bytes first, then use
  // the low bytes only to break a high-byte tie: newHigh means the player's score strictly exceeds the high.
  const rec = currentPlayerRecordPtr(m);
  let hl = rec + 1;
  const hsHi = m.mem8[HIGH_SCORE_OBJ_DESC + 1];
  const recHi = m.mem8[hl];
  const hiEqual = hsHi === recHi;
  const hiBorrow = hsHi < recHi;
  hl = hl - 1;
  const hsLo = m.mem8[HIGH_SCORE_OBJ_DESC];
  const newHigh = hiEqual ? hsLo < m.mem8[hl] : hiBorrow;
  // On a new high, copy the player's two-byte score into the high-score record and repaint it.
  if (newHigh) {
    m.mem8[HIGH_SCORE_OBJ_DESC] = m.mem8[hl];
    m.mem8[HIGH_SCORE_OBJ_DESC + 1] = m.mem8[hl + 1];
    drawHighScore(m);
  }

  // One-player game: there is no other player to hand off to, so drop straight into the attract teardown.
  if (m.mem8[TWO_PLAYER_GAME] === 0) {
    yield* returnToAttractFlow(m);
    return;
  }

  // Two-player game: type the paced "GAME OVER PLAYER<n>" banner (0x14 glyphs from GAME_OVER_TEXT to GAME_OVER_BANNER_SCREEN_ADDR),
  // then stamp this player's number glyph -- 0x1b (digit '1') when ACTIVE_PLAYER_PAGE bit0 is set (player 1),
  // else 0x1c (digit '2') -- at GAMEOVER_PLAYER_NUM_SCREEN_ADDR, and hold a short delay so the message is readable.
  yield* typePacedSpriteRun(m, GAME_OVER_TEXT, 0x14, GAME_OVER_BANNER_SCREEN_ADDR);
  const glyph = m.mem8[ACTIVE_PLAYER_PAGE] & 1 ? 0x1b : 0x1c;
  drawSprite8x8(m, glyph, GAMEOVER_PLAYER_NUM_SCREEN_ADDR);
  yield* waitShortDelay(m);
  // Survivor check: if the OTHER player is also out of lives, both are done -> attract teardown; otherwise
  // hand the turn to the surviving player via the new-round flow.
  const otherLives = otherPlayerFlagPtr(m);
  if (m.mem8[otherLives] === 0) {
    yield* returnToAttractFlow(m);
    return;
  }
  yield* newRoundFlow(m);
}
