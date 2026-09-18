// SPDX-License-Identifier: GPL-3.0-only
/**
 * setupIntroCutsceneStep — step 0 (one-time setup) of the opening Kong-climb cutscene: select the
 * palette bank, draw the static playfield, stamp three fixed tiles, clear the bookkeeping byte,
 * seed the two walk pointers, arm SUBSTATE_TIMER, and advance INTRO_STEP 0 -> 1.
 *
 * LIVE-OUT: memory-only.
 */

import { SUBSTATE_TIMER, INTRO_STEP, INTRO_WALK_PTR_A, INTRO_WALK_PTR_B } from "./names.js";
import { drawBoardLayout } from "./drawBoardLayout.js";

// Palette-bank select latch — a board output, not work RAM.
const PALETTE_BANK_LO = 0x7d86;
const PALETTE_BANK_HI = 0x7d87;

const RECORD_TABLE = 0x380d;

const CUTSCENE_TILE_A = 0x76a3;
const CUTSCENE_TILE_B = 0x7663;
const CUTSCENE_TILE_C = 0x75aa;

const CUTSCENE_BOOKKEEPING = 0x62af;

export function setupIntroCutsceneStep(m) {
  const { regs, mem, mem8, mem16 } = m;

  mem.write8(PALETTE_BANK_LO, 0x00);
  mem.write8(PALETTE_BANK_HI, 0x01);

  regs.de = RECORD_TABLE;
  drawBoardLayout(m);

  mem8[CUTSCENE_TILE_A] = 0x10;
  mem8[CUTSCENE_TILE_B] = 0x10;
  mem8[CUTSCENE_TILE_C] = 0xd4;

  mem8[CUTSCENE_BOOKKEEPING] = 0x00;

  mem16[INTRO_WALK_PTR_A] = 0x38b4;
  mem16[INTRO_WALK_PTR_B] = 0x38cb;

  mem8[SUBSTATE_TIMER] = 0x40;
  mem8[INTRO_STEP] = (mem8[INTRO_STEP] + 1);
}
