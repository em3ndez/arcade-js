// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderMode3ScoreRankingScreen — draw the mode-3 attract SCORE RANKING screen in one call.
 * Resets the attract sub-phase machinery (steps the pacing gate, zeros the phase counter and the
 * start-latch), paints the background block, stamps the rank markers, then for rank 1..5 draws the
 * rank digit and, up an adjacent column, that rank's packed-BCD score read from the high-score table,
 * each flanked by a fixed tile strip. Falls through into the shared final-strip tail.
 * LIVE-OUT: memory-only (VRAM plus the reset work cells).
 */
import { ATTRACT_DEMO_PHASE_COUNTER, POINT_TABLE_DRAW_STATE, START_LATCH, OBJECT_ANIM_STATE_8019, OBJECT_ANIM_STATE_801F, HIGH_SCORE_TABLE_BASE, SCORE_RANKING_HEADER_STRIP, PTS_SUFFIX_STRIP, SCORE_DISPLAY_VRAM_PAGE, SCORE_RANKING_RANK_DIGIT_VRAM_PAGE, SCORE_RANKING_HEADER_DST } from "./names.js";
import { fillTilemapBlock22x32 } from "./fillTilemapBlock22x32.js";
import { placeScoreRankMarkers } from "./placeScoreRankMarkers.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";
import { writeScoreDigitStepUp } from "./writeScoreDigitStepUp.js";
import { writeScoreField } from "./writeScoreField.js";
import { blitMode3FinalStrip } from "./blitMode3FinalStrip.js";

const HEADER_LEN = 0x0d;
const RANK_STRIP_LEN = 0x03;
const SCORE_STRIP_LEN = 0x04;

export function renderMode3ScoreRankingScreen(m) {
  const { mem8 } = m;

  mem8[POINT_TABLE_DRAW_STATE] = mem8[POINT_TABLE_DRAW_STATE] - 1;
  mem8[ATTRACT_DEMO_PHASE_COUNTER] = 0;
  mem8[START_LATCH] = 0;

  fillTilemapBlock22x32(m);

  mem8[OBJECT_ANIM_STATE_8019] = 3;
  for (let p = OBJECT_ANIM_STATE_801F, i = 0; i < 5; i++, p += 4) mem8[p] = 0;

  placeScoreRankMarkers(m);

  copyRunUpTileColumn(m, SCORE_RANKING_HEADER_DST, SCORE_RANKING_HEADER_STRIP, HEADER_LEN);
  let stripSrc = SCORE_RANKING_HEADER_STRIP + HEADER_LEN;

  for (let rank = 1; rank <= 5; rank++) {
    const rankPtr = writeScoreDigitStepUp(m, rank, SCORE_RANKING_RANK_DIGIT_VRAM_PAGE | ((2 * rank + 0xcd) & 0xff));
    copyRunUpTileColumn(m, rankPtr, stripSrc, RANK_STRIP_LEN);
    stripSrc += RANK_STRIP_LEN;

    const scoreWord = HIGH_SCORE_TABLE_BASE + 2 * (rank - 1); // rank r's high-score word, r = 1..5
    const fieldPtr = writeScoreField(m, mem8[scoreWord] | (mem8[scoreWord + 1] << 8), SCORE_DISPLAY_VRAM_PAGE | ((2 * rank + 0xed) & 0xff));
    copyRunUpTileColumn(m, fieldPtr, PTS_SUFFIX_STRIP, SCORE_STRIP_LEN);
  }

  return blitMode3FinalStrip(m);
}
