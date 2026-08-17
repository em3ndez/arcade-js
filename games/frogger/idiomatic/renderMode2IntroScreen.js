// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderMode2IntroScreen — mode-2 intro screen: raise the intro-state cell, fill the play-field tilemap, seed a
 * handful of counters, and blit the title strip. When the shared time byte is under 10 it also draws
 * one digit and three more title strips.
 * LIVE-OUT: memory-only (the seeded cells and the tilemap/VRAM the fill and blits write).
 */
import {
  POINT_TABLE_DRAW_STATE, INTRO_COUNTER_829B, OBJECT_ANIM_STATE_8021, INTRO_COUNTER_801B, INTRO_COUNTER_802B, SHARED_TIME_BYTE,
  MAIN_TITLE_STRIP_SRC, INTRO_TITLE_STRIP2_SRC, INTRO_TITLE_STRIP3_SRC, INTRO_TITLE_STRIP4_SRC, MAIN_TITLE_STRIP_VRAM, SCORE_DIGIT_TIME_LOW_VRAM,
} from "./names.js";
import { fillTilemapBlock28x32 } from "./fillTilemapBlock28x32.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";
import { writeScoreDigitStepUp } from "./writeScoreDigitStepUp.js";

export function renderMode2IntroScreen(m) {
  const { mem8 } = m;

  mem8[POINT_TABLE_DRAW_STATE] = 0xff;
  fillTilemapBlock28x32(m);

  mem8[INTRO_COUNTER_829B] = 0;
  mem8[OBJECT_ANIM_STATE_8021] = 0;
  mem8[INTRO_COUNTER_801B] = 5;
  mem8[INTRO_COUNTER_802B] = 3;

  copyRunUpTileColumn(m, MAIN_TITLE_STRIP_VRAM, MAIN_TITLE_STRIP_SRC, 11);

  if (mem8[SHARED_TIME_BYTE] >= 10) return; // splash-only when the shared time byte is at 10 or above

  // strips 2-4 continue up the column from the write pointer each blit advances
  copyRunUpTileColumn(m, writeScoreDigitStepUp(m, mem8[SHARED_TIME_BYTE], SCORE_DIGIT_TIME_LOW_VRAM), INTRO_TITLE_STRIP2_SRC, 7);
  copyRunUpTileColumn(m, undefined, INTRO_TITLE_STRIP3_SRC, 4);
  copyRunUpTileColumn(m, undefined, INTRO_TITLE_STRIP4_SRC, 7);
}
