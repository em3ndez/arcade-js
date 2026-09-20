// SPDX-License-Identifier: GPL-3.0-only
/**
 * setupIntroCutsceneStep — step 0 (one-time setup) of the opening Kong-climb cutscene: select the
 * palette bank, draw the static playfield, stamp three fixed tiles, clear the bookkeeping byte,
 * seed the two walk pointers, arm SUBSTATE_TIMER, and advance INTRO_STEP 0 -> 1.
 *
 * LIVE-OUT: memory-only.
 */

import {
  INTRO_CUTSCENE_TILE_A,
  INTRO_CUTSCENE_TILE_B,
  INTRO_CUTSCENE_TILE_C,
  INTRO_SETUP_LAYOUT_TABLE,
  INTRO_STEP,
  INTRO_WALK_PTR_A,
  INTRO_WALK_PTR_B,
  ANIM_PACE_COUNTER,
  PALETTE_BANK_BIT0,
  PALETTE_BANK_BIT1,
  SUBSTATE_TIMER,
} from "./names.js";
import { drawBoardLayout } from "./drawBoardLayout.js";

// Palette-bank select latch — a board output, not work RAM.

export function setupIntroCutsceneStep(m) {
  const { regs, mem8, mem16 } = m;

  mem8[PALETTE_BANK_BIT0] = 0x00;
  mem8[PALETTE_BANK_BIT1] = 0x01;

  regs.de = INTRO_SETUP_LAYOUT_TABLE;
  drawBoardLayout(m);

  mem8[INTRO_CUTSCENE_TILE_A] = 0x10;
  mem8[INTRO_CUTSCENE_TILE_B] = 0x10;
  mem8[INTRO_CUTSCENE_TILE_C] = 0xd4;

  mem8[ANIM_PACE_COUNTER] = 0x00;

  mem16[INTRO_WALK_PTR_A] = 0x38b4;
  mem16[INTRO_WALK_PTR_B] = 0x38cb;

  mem8[SUBSTATE_TIMER] = 0x40;
  mem8[INTRO_STEP] = (mem8[INTRO_STEP] + 1);
}
