// SPDX-License-Identifier: GPL-3.0-only
/**
 * addScoreAndAwardExtraLife — add the BCD delta in DE to the active player's score word, award the
 * threshold bonus once, then keep the running high score. Gated off while the game is not in play. The
 * BCD add propagates the low-byte daa carry into the high byte. On the
 * first frame the score reaches the target word and the player's award flag is clear, it marks the flag,
 * bumps the active player's counter, stamps the bonus tile into that counter's HUD column and queues the
 * tile update. The high score then trails the larger score. LIVE-OUT: memory-only.
 */
import {
  PLAY_FLAG, ACTIVE_PLAYER, PLAYER1_SCORE, PLAYER2_SCORE,
  PLAYER1_EXTRA_LIFE_AWARDED, PLAYER2_EXTRA_LIFE_AWARDED,
  TIME_REMAINING_P1, TIME_REMAINING_P2, loc_83cf, EXTRA_LIFE_SCORE_TARGET, HIGH_SCORE,
} from "./names.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

const HUD_SLOT_TOP = 0xabde;   // base the bonus tile walks back from, one row per counter step
const HUD_ROW_STEP = 0x20;
const BONUS_TILE = 0x4d;
const TILE_UPDATE_CMD = 0x07;

export function addScoreAndAwardExtraLife(m, delta = m.regs.de) {
  const { regs, mem8, mem16 } = m;
  if (mem8[PLAY_FLAG] === 0) return; // not in play: no scoring

  const p1 = mem8[ACTIVE_PLAYER] === 1;
  const scoreLo = p1 ? PLAYER1_SCORE : PLAYER2_SCORE;
  const scoreHi = (scoreLo + 1) & 0xffff;

  regs.a = delta & 0xff;
  regs.add(mem8[scoreLo]);
  regs.daa();
  mem8[scoreLo] = regs.a;
  regs.a = delta >> 8;
  regs.adc(mem8[scoreHi]);
  regs.daa();
  mem8[scoreHi] = regs.a;
  const score = mem16[scoreLo];

  const awardCell = p1 ? PLAYER1_EXTRA_LIFE_AWARDED : PLAYER2_EXTRA_LIFE_AWARDED;
  if (mem8[awardCell] === 0 && score >= mem16[EXTRA_LIFE_SCORE_TARGET]) {
    mem8[loc_83cf] = 0;
    mem8[awardCell] = 1;
    const counterCell = p1 ? TIME_REMAINING_P1 : TIME_REMAINING_P2;
    const count = (mem8[counterCell] + 1) & 0xff;
    mem8[counterCell] = count;

    let slot = HUD_SLOT_TOP, n = count;
    do { slot = (slot - HUD_ROW_STEP) & 0xffff; n = (n - 1) & 0xff; } while (n !== 0);
    mem8[slot] = BONUS_TILE;

    enqueueSoundCommand(m, TILE_UPDATE_CMD);
  }

  if (mem16[HIGH_SCORE] < score) mem16[HIGH_SCORE] = score;
}
