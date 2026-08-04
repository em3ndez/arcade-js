// SPDX-License-Identifier: GPL-3.0-only
/**
 * setupIntroCutsceneStep — step 0 of the opening Kong-climb cutscene: draw the
 * cutscene playfield and seed its animation state.
 *
 * The opening cutscene — Kong hauling Pauline up the girders, at the head of every
 * credited game — is driven by INTRO_STEP, which a dispatcher walks 0 -> 7, one
 * handler per step. This is entry 0, the one-time SETUP, run while the game sub-state
 * is the cutscene value and INTRO_STEP is still 0. Straight-line, no data-dependent
 * branch, no work-RAM inputs — every value stored is an immediate or comes out of a
 * fixed program-memory table:
 *
 *   - Select palette bank %01 (PALETTE_BANK_LO <- 0, PALETTE_BANK_HI <- 1).
 *   - Draw the cutscene's static playfield: walk the terminated line-segment record
 *     table (girders + ladders) and stamp each segment into video RAM, leaving the
 *     walk's per-record scratch behind.
 *   - Stamp three fixed cutscene tiles.
 *   - Clear the cutscene bookkeeping byte.
 *   - Seed the two cutscene walk pointers the later steps consume, INTRO_WALK_PTR_A
 *     and INTRO_WALK_PTR_B.
 *   - Arm SUBSTATE_TIMER to 0x40 — a 64-frame countdown the following step gates on.
 *   - Advance INTRO_STEP 0 -> 1, so the NEXT dispatch runs the following phase instead
 *     of re-running this setup.
 *
 * THE PLAYFIELD DRAW STILL TAKES ITS TABLE POINTER IN A REGISTER, so this routine
 * loads the record-table address into the register pair before calling it. The stack
 * pointer is inherited from the caller and left alone; the draw pins it per record and
 * returns it unchanged.
 *
 * LIVE-OUT: memory-only — the palette latch, the drawn tilemap, the layout walk's
 * per-record scratch, the three cutscene tiles, the bookkeeping byte, the two walk
 * pointers, SUBSTATE_TIMER and INTRO_STEP.
 */

import { SUBSTATE_TIMER, INTRO_STEP, INTRO_WALK_PTR_A, INTRO_WALK_PTR_B } from "./names.js";
import { drawBoardLayout } from "./drawBoardLayout.js"; // walk the record table + draw the playfield

// The two-bit palette-bank select latch (ls259.6h) — a board control output, NOT work
// RAM. Setting %01: LO <- 0, HI <- 1.
const PALETTE_BANK_LO = 0x7d86;
const PALETTE_BANK_HI = 0x7d87;

const RECORD_TABLE = 0x380d; // line-segment record table for the playfield (girders + ladders)

// Three fixed cutscene tiles stamped into video RAM.
const CUTSCENE_TILE_A = 0x76a3;
const CUTSCENE_TILE_B = 0x7663;
const CUTSCENE_TILE_C = 0x75aa;

const CUTSCENE_BOOKKEEPING = 0x62af; // work-RAM byte cleared on each setup

export function setupIntroCutsceneStep(m) {
  const { regs, mem } = m;

  // Palette bank %01.
  mem.write8(PALETTE_BANK_LO, 0x00);
  mem.write8(PALETTE_BANK_HI, 0x01);

  // Draw the cutscene playfield from the segment table. The draw reads its table
  // pointer out of the register pair, so aim it there first.
  regs.de = RECORD_TABLE;
  drawBoardLayout(m);

  // Three fixed cutscene tiles.
  mem.write8(CUTSCENE_TILE_A, 0x10);
  mem.write8(CUTSCENE_TILE_B, 0x10);
  mem.write8(CUTSCENE_TILE_C, 0xd4);

  // Clear the cutscene bookkeeping byte.
  mem.write8(CUTSCENE_BOOKKEEPING, 0x00);

  // Seed the two walk pointers the later cutscene steps advance.
  mem.write16(INTRO_WALK_PTR_A, 0x38b4);
  mem.write16(INTRO_WALK_PTR_B, 0x38cb);

  // Arm the 64-frame phase countdown, then advance INTRO_STEP 0 -> 1 so the next
  // dispatch runs step 1 instead of re-running this setup.
  mem.write8(SUBSTATE_TIMER, 0x40);
  mem.write8(INTRO_STEP, (mem.read8(INTRO_STEP) + 1) & 0xff);
}
