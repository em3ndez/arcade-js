// SPDX-License-Identifier: GPL-3.0-only
import { drawLivesDigit } from "./drawLivesDigit.js";
import { loc_1910 } from "./loc_1910.js";
import { currentPlayerRecordPtr } from "./currentPlayerRecordPtr.js";
import { drawHighScore } from "./drawHighScore.js";
import { typePacedSpriteRun } from "./typePacedSpriteRun.js";
import { drawSprite8x8 } from "./drawSprite8x8.js";
import { loc_0ab1 } from "./loc_0ab1.js";
import { loc_18e7 } from "./loc_18e7.js";
import { loc_16c9 } from "./loc_16c9.js";
import { newRoundFlow } from "./newRoundFlow.js";
import { ACTIVE_PLAYER_PAGE, TWO_PLAYER_GAME, HIGH_SCORE_OBJ_DESC, loc_1aa6, loc_2803, loc_3a03 } from "./names.js";

// Game-over for the active player: zero the lives digit and this player's in-progress flag, then promote
// the player's score to the high score when it beats it (16-bit compare, high byte then low) and repaint
// it. A one-player game joins the attract teardown. A two-player game types the closing banner and this
// player's number, then either joins the teardown (the other player is also out) or hands off to the new
// round for the surviving player. Generator; memory + IO.
export function* gameOverFlow(m) {
  drawLivesDigit(m, 0x00);
  m.mem8[loc_1910(m)] = 0x00;

  const rec = currentPlayerRecordPtr(m);
  let hl = rec + 1;
  const hsHi = m.mem8[HIGH_SCORE_OBJ_DESC + 1];
  const recHi = m.mem8[hl];
  const hiEqual = hsHi === recHi;
  const hiBorrow = hsHi < recHi;
  hl = hl - 1;
  const hsLo = m.mem8[HIGH_SCORE_OBJ_DESC];
  const newHigh = hiEqual ? hsLo < m.mem8[hl] : hiBorrow;
  if (newHigh) {
    m.mem8[HIGH_SCORE_OBJ_DESC] = m.mem8[hl];
    m.mem8[HIGH_SCORE_OBJ_DESC + 1] = m.mem8[hl + 1];
    drawHighScore(m);
  }

  if (m.mem8[TWO_PLAYER_GAME] === 0) {
    yield* loc_16c9(m);
    return;
  }

  yield* typePacedSpriteRun(m, loc_1aa6, 0x14, loc_2803);
  const glyph = m.mem8[ACTIVE_PLAYER_PAGE] & 1 ? 0x1b : 0x1c;
  drawSprite8x8(m, glyph, loc_3a03);
  yield* loc_0ab1(m);
  const otherLives = loc_18e7(m);
  if (m.mem8[otherLives] === 0) {
    yield* loc_16c9(m);
    return;
  }
  yield* newRoundFlow(m);
}
