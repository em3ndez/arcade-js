// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderMode3ScoreRankingScreen — draw the mode-3 attract SCORE RANKING screen in one call.
 * Resets the attract sub-phase machinery (steps the pacing gate, zeros the phase counter and the
 * start-latch), paints the background block, stamps the rank markers, then for rank 1..5 draws the
 * rank digit and, up an adjacent column, that rank's packed-BCD score read from the high-score table,
 * each flanked by a fixed tile strip. Falls through into the shared final-strip tail.
 * LIVE-OUT: memory-only (VRAM plus the reset work cells).
 */
import { loc_83d7, loc_83d8, START_LATCH, loc_8019, loc_801f, loc_83f1, loc_2ee5, loc_2fba } from "./names.js";
import { fillTilemapBlock22x32 } from "./fillTilemapBlock22x32.js";
import { placeScoreRankMarkers } from "./placeScoreRankMarkers.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";
import { writeScoreDigitStepUp } from "./writeScoreDigitStepUp.js";
import { writeScoreField } from "./writeScoreField.js";

const HEADER_DST = 0xaaac;
const HEADER_LEN = 0x0d;
const RANK_STRIP_LEN = 0x03;
const SCORE_STRIP_LEN = 0x04;

export function renderMode3ScoreRankingScreen(m) {
  const { regs, mem8 } = m;

  mem8[loc_83d8] = (mem8[loc_83d8] - 1) & 0xff;
  mem8[loc_83d7] = 0;
  mem8[START_LATCH] = 0;

  fillTilemapBlock22x32(m);

  mem8[loc_8019] = 3;
  for (let p = loc_801f, i = 0; i < 5; i++, p += 4) mem8[p] = 0;

  placeScoreRankMarkers(m);

  copyRunUpTileColumn(m, HEADER_DST, loc_2ee5, HEADER_LEN);
  let stripSrc = regs.de; // the running strip source walks forward across the five rank rows

  for (let rank = 1; rank <= 5; rank++) {
    writeScoreDigitStepUp(m, rank, 0xaa00 | ((2 * rank + 0xcd) & 0xff));
    copyRunUpTileColumn(m, regs.hl, stripSrc, RANK_STRIP_LEN);
    stripSrc = regs.de;

    const scoreWord = loc_83f1 + 2 * (rank - 1); // rank r's high-score word, r = 1..5
    regs.de = mem8[scoreWord] | (mem8[scoreWord + 1] << 8);
    regs.hl = 0xa900 | ((2 * rank + 0xed) & 0xff);
    writeScoreField(m);
    copyRunUpTileColumn(m, regs.hl, loc_2fba, SCORE_STRIP_LEN);
  }

  return m.call(0x0c17);
}
