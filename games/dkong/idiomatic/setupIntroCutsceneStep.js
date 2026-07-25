// SPDX-License-Identifier: GPL-3.0-only
/**
 * setupIntroCutsceneStep — step 0 of the opening Kong-climb cutscene: draw the
 * cutscene playfield and seed its animation state.  ROM 0x0a8a.
 *
 * The opening cutscene (Kong hauling Pauline up the girders, at the head of every
 * credited game) is driven by INTRO_STEP (0x6385), which loc_0a76
 * (dispatchIntroCutsceneStep) walks 0 -> 7 through the rst-0x28 table at ROM 0x0A7A,
 * one handler per step. This is entry 0 — the one-time SETUP, run while
 * GAME_SUBSTATE (0x600A) == 7 and INTRO_STEP == 0. Straight-line, no data-dependent
 * branch, no work-RAM inputs (every value is an immediate or a ROM table):
 *
 *   - Select palette bank %01 (PALETTE_BANK_LO <- 0, PALETTE_BANK_HI <- 1).
 *   - Draw the cutscene's static playfield: call loc_0da7, which walks the
 *     0xAA-terminated line-segment table at ROM 0x380D (girders + ladders) and
 *     stamps each segment into VRAM, leaving its per-record scratch in 0x63AB..
 *   - Stamp three fixed cutscene tiles: 0x76A3 <- 0x10, 0x7663 <- 0x10, 0x75AA <- 0xD4.
 *   - Clear the work-RAM cutscene bookkeeping byte 0x62AF to 0.
 *   - Seed the two cutscene walk pointers the later steps consume:
 *       0x63C2 <- 0x38B4 (loc_0b06's) and 0x63C4 <- 0x38CB (loc_0b68's).
 *   - Arm SUBSTATE_TIMER (0x6009) to 0x40 — a 64-frame countdown for step 1
 *     (runIntroClimbStep gates on this expiring).
 *   - `inc (INTRO_STEP)` — advance 0 -> 1 so the NEXT dispatch runs the following
 *     phase instead of re-running this setup.
 *
 * CALLEE. loc_0da7 is already idiomatic but still reads its table pointer from the
 * Z80 register file (regs.de) and pins the vestigial SP internally — so this routine
 * sets regs.de = 0x380D before the direct call (the boundary where registers remain),
 * exactly as the oracle's `ld de,0x380D` did. SP is inherited from the caller and left
 * alone; loc_0da7 pins it per record and returns it unchanged.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0a8a.test.js.
 * GATE:     crafted-entry — attract (6000 frames) dispatches 0x0a8a ZERO times (the
 *           intro cutscene is a credited game's per-board head, GAME_SUBSTATE 7), so
 *           the gate is a real booted attract base, cloned, oracle-vs-idiomatic on
 *           fresh clones. The only work-RAM-dependent output is `inc (INTRO_STEP)`, so
 *           INTRO_STEP is swept EXHAUSTIVELY (0..255, incl. the 0xFF->0x00 wrap); every
 *           other output is an immediate / the deterministic 0x380D record walk. Teeth:
 *           a swapped walk-pointer seed (0x63C2) and a dropped INTRO_STEP advance.
 * LIVE-OUT: memory-only — the palette latch, VRAM (0x76A3/0x7663/0x75AA + loc_0da7's
 *           girder/ladder tiles), the 0x63AB.. segment scratch, 0x62AF, 0x63C2/0x63C4,
 *           SUBSTATE_TIMER, and INTRO_STEP. No live registers/flags: the caller
 *           (dispatchIntroCutsceneStep's rst-0x28 tail) makes no `ret cc` and reloads
 *           A/HL/DE before reading them (oracle's residual A=0x40, HL=0x6385, DE/BC =
 *           loc_0da7's leavings are all dead ABI). SP/pc are the dropped stack model.
 * NAMES:    SUBSTATE_TIMER (0x6009), INTRO_STEP (0x6385) from ram.js. Hex-kept (no
 *           ram.js name): PALETTE_BANK_LO/HI (ls259 board latch, not work RAM), the
 *           0x380D record table + 0x38B4/0x38CB pointer seeds (ROM data), the three
 *           cutscene tiles (VRAM), 0x62AF, and 0x63C2/0x63C4 (cutscene walk pointers).
 */

import { SUBSTATE_TIMER, INTRO_STEP } from "../optimized/ram.js";
import { loc_0da7 } from "./loc_0da7.js"; // ROM 0x0DA7 — walk 0x380D + draw the playfield

// The two-bit palette-bank select latch (ls259.6h at 0x7D86/0x7D87) — a board control
// output, NOT work RAM, so it has no ram.js name. Setting %01: LO <- 0, HI <- 1.
const PALETTE_BANK_LO = 0x7d86;
const PALETTE_BANK_HI = 0x7d87;

const RECORD_TABLE = 0x380d; // ROM line-segment table loc_0da7 walks (girders + ladders)

// Three fixed cutscene tiles stamped into VRAM (ROM-data addresses, no ram.js name).
const CUTSCENE_TILE_A = 0x76a3;
const CUTSCENE_TILE_B = 0x7663;
const CUTSCENE_TILE_C = 0x75aa;

const CUTSCENE_BOOKKEEPING = 0x62af; // work-RAM byte cleared each setup (unnamed)

// The two cutscene walk pointers later steps consume: 0x63C2 is loc_0b06's, 0x63C4 is
// loc_0b68's (unnamed in ram.js). Seeded to ROM addresses 0x38B4 / 0x38CB.
const WALK_PTR_0B06 = 0x63c2;
const WALK_PTR_0B68 = 0x63c4;

export function setupIntroCutsceneStep(m) {
  const { regs, mem } = m;

  // Palette bank %01.
  mem.write8(PALETTE_BANK_LO, 0x00);
  mem.write8(PALETTE_BANK_HI, 0x01);

  // Draw the cutscene playfield from the 0x380D segment table. loc_0da7 reads its
  // table pointer from regs.de (still-register boundary), so set it as `ld de,0x380D`.
  regs.de = RECORD_TABLE;
  loc_0da7(m);

  // Three fixed cutscene tiles.
  mem.write8(CUTSCENE_TILE_A, 0x10);
  mem.write8(CUTSCENE_TILE_B, 0x10);
  mem.write8(CUTSCENE_TILE_C, 0xd4);

  // Clear the cutscene bookkeeping byte.
  mem.write8(CUTSCENE_BOOKKEEPING, 0x00);

  // Seed the two walk pointers the later cutscene steps advance.
  mem.write16(WALK_PTR_0B06, 0x38b4);
  mem.write16(WALK_PTR_0B68, 0x38cb);

  // Arm the 64-frame phase countdown, then advance INTRO_STEP 0 -> 1 so the next
  // dispatch runs step 1 instead of re-running this setup.
  mem.write8(SUBSTATE_TIMER, 0x40);
  mem.write8(INTRO_STEP, (mem.read8(INTRO_STEP) + 1) & 0xff); // inc (0x6385)
}
