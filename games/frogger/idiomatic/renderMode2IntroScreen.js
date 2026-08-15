// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderMode2IntroScreen — mode-2 intro screen: raise the intro-state cell, fill the play-field tilemap, seed a
 * handful of counters, and blit the title strip. When the shared time byte is under 10 it also draws
 * one digit and three more title strips.
 * LIVE-OUT: memory-only (the seeded cells and the tilemap/VRAM the fill and blits write).
 */
import {
  loc_83d8, loc_829b, OBJECT_ANIM_STATE_8021, loc_801b, loc_802b, SHARED_TIME_BYTE,
  loc_2f5c, loc_2fae, loc_2f73, loc_2f92, MAIN_TITLE_STRIP_VRAM, loc_ab15,
} from "./names.js";
import { fillTilemapBlock28x32 } from "./fillTilemapBlock28x32.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";
import { writeScoreDigitStepUp } from "./writeScoreDigitStepUp.js";

export function renderMode2IntroScreen(m) {
  const { regs, mem8 } = m;

  mem8[loc_83d8] = 0xff;
  fillTilemapBlock28x32(m);

  mem8[loc_829b] = 0;
  mem8[OBJECT_ANIM_STATE_8021] = 0;
  mem8[loc_801b] = 5;
  mem8[loc_802b] = 3;

  copyRunUpTileColumn(m, MAIN_TITLE_STRIP_VRAM, loc_2f5c, 11);

  if (mem8[SHARED_TIME_BYTE] >= 10) return; // splash-only when the shared time byte is at 10 or above

  writeScoreDigitStepUp(m, mem8[SHARED_TIME_BYTE], loc_ab15);

  // strips 2-4 continue up the column from the write pointer each blit advances (regs.hl)
  copyRunUpTileColumn(m, regs.hl, loc_2fae, 7);
  copyRunUpTileColumn(m, regs.hl, loc_2f73, 4);
  copyRunUpTileColumn(m, regs.hl, loc_2f92, 7);
}
