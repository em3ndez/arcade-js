// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnInterludeHeart — the board-cleared interlude's opening tableau: silence sound, seed
 * the heart sprite record plus the blink-sprite code, blank a 3-cell run of the tilemap,
 * then set the sound-priority pair.  ROM 0x1708.
 *
 * A straight-line, INPUT-INDEPENDENT initializer: it reads no memory and takes no
 * arguments — every store is a constant, so its effect on the compared state is the
 * same regardless of the machine state it is entered with. In order:
 *
 *   1. silenceSound (ROM 0x011c) — zero every sound output and its work-RAM shadow
 *      (0x6080-0x608B), a clean audio slate before the priority write below.
 *   2. Seed the 4-byte sprite record at 0x6A20 (inside SPRITE_BUFFER 0x6900-0x6A7F)
 *      to the constants 0x80/0x76/0x09/0x20 — the sprite-record [X, code, attr, Y]
 *      field order observed for MARIO_SPRITE_RECORD. Code 0x76 is the whole heart
 *      (decoded from gfx2.bin — see beginKongRecaptureInterlude.js); loc_18c6 later
 *      animates this same record during the 0x6388 board-advance sequence.
 *   3. Seed the blink-sprite code at 0x6905 (sprite-buffer record 1, +1 byte) to
 *      0x13 — the byte whose bit 7 the attract/intro colour cycle toggles to blink
 *      it (loc_04a3/loc_04ac/loc_04e1/loc_04f9 read and flip 0x6905).
 *   4. fillDescendingColumn (ROM 0x0514) — the generic 3-cell descending fill, here
 *      pointed at 0x75C4 with stride 0x20 (one tilemap row) and start value 0x10, so it
 *      lays 0x10 / 0x0F / 0x0E into the cells 0x75C4 / 0x75E4 / 0x7604.
 *      WHAT THAT ACTUALLY DOES AT THIS CALL SITE — and it is not what the "colour column"
 *      wording this header used to carry implied. 0x7400-0x77FF is the TILEMAP CHARACTER
 *      RAM (boards/dkong/memory.js VIDEO_RAM_BASE), the only RAM the tilemap has; dkong
 *      has no colour RAM at all — a cell's colour comes from the v-5e PROM, indexed by
 *      column and four-row band (boards/dkong/video.js renderTilemapPens), which is ROM
 *      and cannot be written. And the three bytes written HERE, tile codes 0x10 / 0x0F /
 *      0x0E, all decode to entirely BLANK tiles in gfx1.bin (0 non-zero pixels each,
 *      decoded with this board's own decodeTiles; they sit in the blank run 0x0A-0x10).
 *      So this call BLANKS three tilemap cells — three cells of one column, one tilemap row
 *      apart, at video-RAM offsets 0x1C4 / 0x1E4 / 0x204 — painting no glyph and setting no
 *      colour.
 *      That is a fact about THIS call's operands, not about the leaf: fillDescendingColumn
 *      is shared, and its rivet-board callers hand it start values whose tiles are real
 *      visible glyphs.
 *   5. Set the sound-priority pair SND_PRIORITY / SND_PRIORITY_FRAMES (0x608A/0x608B)
 *      to 0x07 / 0x03 — re-written after silenceSound zeroed them.
 *
 * Its ONLY callers are the two step-0 openers of the board-cleared interlude:
 * beginKongRecaptureInterlude (ROM 0x1654, odd boards) and begin50mKongRecaptureInterlude
 * (ROM 0x16A3, 50m). The "board load / intro cutscene" reading this header used to carry is
 * REFUTED by the PC-attributed grounding recorded in beginKongRecaptureInterlude.js: 6 fires
 * in a whole progression run, ALL of them at sub-state 0x16 step 0, with 0 fires in the
 * 769-frame opening cutscene and 0 in 24,243 attract frames.
 *
 * NAME: promoted from loc_1708 in this pass. It names the tableau's one identified element —
 * the heart sprite (code 0x76) seeded in step 2 — and the scene that tableau opens.
 * WHAT THIS NAME DOES NOT CLAIM: that every write here is part of the heart. The three blanked
 * tilemap cells and the sound-priority pair belong to the same opening tableau, but what removing
 * those three cells clears off the screen was not separately grounded.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1708.test.js.
 * GATE:     crafted-entry — INPUT-INDEPENDENT and straight-line (reads no memory,
 *           takes no args; every store is a constant, so there is no data-dependent
 *           branch and no unreached arm). It is NOT on the attract or coin+start path
 *           exercised here (its callers, the interlude step-0 openers
 *           begin50mKongRecaptureInterlude and beginKongRecaptureInterlude, are not reached
 *           by those tapes), so it is validated on real captured ATTRACT states used as
 *           entries — valid because the routine is proven input-independent — PLUS
 *           crafted pre-dirtied entries proving it overwrites prior contents. Teeth: a
 *           wrong sprite byte and a skipped tilemap fill.
 * LIVE-OUT: memory-only — both callers reload A/HL/DE/BC before use and consume no
 *           register or flag this leaves (begin50mKongRecaptureInterlude `ld a,(0x6910)`;
 *           beginKongRecaptureInterlude `ld hl,0x385c`). SP/PC are not compared — the
 *           direct-call layer replaces the oracle's push16/ret stack+PC bookkeeping with
 *           the JS call stack. The three sound-hardware latches silenceSound issues
 *           (0x7D00-07, 0x7D80, 0x7C00) are write-only io outputs, not in the RAM dump.
 * NAMES:    SND_PRIORITY (0x608A), SND_PRIORITY_FRAMES (0x608B) from ram.js. The
 *           sprite-buffer bytes 0x6A20-0x6A23, the blink code 0x6905, and the tilemap
 *           fill start 0x75C4 have no ram.js symbol and stay local hex constants.
 */

import { SND_PRIORITY, SND_PRIORITY_FRAMES } from "./ram.js";
import { silenceSound } from "./silenceSound.js"; // ROM 0x011c
import { fillDescendingColumn } from "./fillDescendingColumn.js"; // ROM 0x0514

// A 4-byte sprite record inside SPRITE_BUFFER (0x6900-0x6A7F); no ram.js symbol.
const SPRITE_RECORD_6A20 = 0x6a20;
// Sprite-buffer record 1, +1 byte — the blink-sprite code the colour cycle toggles.
const BLINK_SPRITE_CODE = 0x6905;
// Tilemap character-RAM start for the 3-cell descending fill (via fillDescendingColumn).
// 0x7400-0x77FF is the tilemap's character RAM; the three codes written from here (0x10,
// 0x0F, 0x0E) are blank tiles, so this call blanks the cells rather than painting them.
const TILEMAP_COLUMN = 0x75c4;

export function spawnInterludeHeart(m) {
  const { regs, mem } = m;

  // 1. Silence every sound output (and its work-RAM shadow 0x6080-0x608B).
  silenceSound(m); // ROM 0x011c

  // 2. Seed the fixed 4-byte sprite record at 0x6A20: [X, code, attr, Y].
  mem.write8(SPRITE_RECORD_6A20 + 0, 0x80);
  mem.write8(SPRITE_RECORD_6A20 + 1, 0x76);
  mem.write8(SPRITE_RECORD_6A20 + 2, 0x09);
  mem.write8(SPRITE_RECORD_6A20 + 3, 0x20);

  // 3. Seed the blink-sprite code at 0x6905.
  mem.write8(BLINK_SPRITE_CODE, 0x13);

  // 4. 3-cell descending fill from 0x75C4 in tilemap character RAM (stride 0x20 = one
  //    tilemap row, start 0x10 -> codes 0x10/0x0F/0x0E). All three are blank tiles, so
  //    the three cells end up cleared. fillDescendingColumn takes HL/A/DE as live-in.
  regs.hl = TILEMAP_COLUMN; // ld hl,0x75c4
  regs.de = 0x0020; //        ld de,0x0020
  regs.a = 0x10; //           ld a,0x10
  fillDescendingColumn(m); // ROM 0x0514

  // 5. Set the sound-priority pair (silenceSound just zeroed both).
  mem.write8(SND_PRIORITY, 0x07); //        0x608A
  mem.write8(SND_PRIORITY_FRAMES, 0x03); // 0x608B
}
