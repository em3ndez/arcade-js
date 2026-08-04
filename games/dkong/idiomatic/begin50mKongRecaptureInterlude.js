// SPDX-License-Identifier: GPL-3.0-only
/**
 * begin50mKongRecaptureInterlude — sequence step 0: spawn the heart, stamp the fixed ten-record
 * figure over the sprite-object block re-anchored to its previous X, then advance the step.
 * ROM 0x16a3.
 *
 * This is index 0 of the rst-0x28 table at ROM 0x1637, dispatched by dispatchBoardClearedInterlude (the L2
 * board-advance handler for game sub-state 0x600A == 0x16) on the step selector at
 * 0x6388. As the sequence's first step it sets the figure up, then bumps 0x6388 so the
 * next frame runs the next step (dispatchKongWalkFrame, ROM 0x16bb). In order:
 *
 *   1. spawnInterludeHeart (ROM 0x1708) — the interlude's opening tableau: silence sound, seed
 *      the whole-heart sprite record (code 0x76) + the blink-sprite code, blank three tilemap
 *      cells, set the sound-priority pair. Input-independent; touches none of the state below.
 *
 *   2. Capture record 2's CURRENT on-screen X (0x6910, the +0 byte of the third record
 *      in SPRITE_OBJ_BLOCK) and turn it into a shift: `shift = oldX - 0x3b`. This read
 *      happens BEFORE the block copy below overwrites 0x6910 — the ordering is the whole
 *      point, so the shift measures the OLD X, not the template's.
 *
 *   3. loadSpriteObjectBlock (ROM 0x004e) — copy the fixed 40-byte / ten-record figure
 *      template at ROM 0x385c over SPRITE_OBJ_BLOCK (0x6908). The template's record-2 X
 *      byte is 0x3b (ROM 0x3864, verified).
 *
 *   4. addToSpriteObjectColumn (ROM 0x0038, rst 0x38) — add `shift` into the X byte of
 *      all ten records. Record 2 therefore lands back on its previous X (0x3b + (oldX -
 *      0x3b) == oldX, 8-bit), and the whole figure is carried with it: the figure is
 *      re-stamped from ROM but keeps its horizontal position across the re-stamp.
 *
 *   5. Advance the sequence step: `inc (0x6388)`.
 *
 * NAME: promoted in understanding pass 15 by a proposer plus an independent blind confirmer
 * (docs/reviewer-rules.md R4/R5). Corroboration from OUTSIDE this routine: BOARD (0x6227) is
 * `[seen]` with "2=50m conveyors", and the pass-14 writer table attributes the step write at
 * pc 0x1707 to board 2 only, exactly one per 50m completion — that is where the "50m" in the name
 * comes from. The heart is the same PC-attributed spawn the odd-board opening uses (6 fires in the
 * run: 3× board 1, 1× board 2, 2× board 3, ALL of them sub 0x16 step 0), and the confirmer
 * independently established that sprite code 0x76 decodes to a heart in gfx2.bin. That this is the
 * SAME figure as the odd-board opening is a code fact, not a snapshot reading: both load the
 * identical ROM template 0x385C. The confirmer also traced the re-anchor arithmetic outside this
 * file — names.js's M50_OBJ_ROW_SHIFT (0x63B7) records `entry_03fb`/`entry_0400` computing the same
 * `(0x6910) − 0x3B` expression on the BOARD==2 arm during play, with shiftEvenBoardSpriteColumn
 * adding it into this same block's X column, which is precisely WHY the 50m arm must preserve X
 * where the odd-board arm need not — and verified 0x3B as the template's own record-2 X byte in
 * maincpu.bin. Grounding saw the figure re-stamped at X 182/168, 109 px from the template anchor.
 * Blind, the confirmer named this `beginKongRecaptureInterludeAtCurrentX` and voted PROMOTE: it
 * put the re-anchor in the name where the promoted name puts the board, so the wording differs;
 * the meaning both derivations reached is the same — the 50m opening step, which re-stamps the
 * figure at the X it already occupies.
 *
 * What the name does NOT claim. "Kong" rests on the pass-14 snapshot reading ("standing at the
 * RIGHT end of the top girder on 50m") plus the shared-template argument above, not on a byte
 * measurement. No record of the ten-record block is identified as Pauline — that separation was
 * never made — so the name says who is re-stamped, not who is carried.
 *
 * Memory-equivalent to the frozen oracle — equivalence-16a3.test.js.
 * GATE:     exhaustive over the input surface — UNREACHED in attract (0 dispatches /
 *           4000 frames; it is a board-cleared interlude step), so entries are crafted
 *           from a real attract RAM base. The only data-dependent input is the entry
 *           byte at 0x6910 (drives `shift` across its full range); the sweep over all
 *           256 of its values is exhaustive, plus a 256-value breadth sweep of the
 *           0x6388 step counter (covering the inc's 0xFF->0x00 wrap). Teeth: a twin that
 *           reads 0x6910 AFTER the block copy (measuring the template, not the old X).
 * LIVE-OUT: memory-only — the sprite-object block (0x6908-0x692F), the 0x6388 step, and
 *           everything spawnInterludeHeart writes (sound RAM 0x6080-0x608B, sprite bytes 0x6905 /
 *           0x6A20-0x6A23, tilemap cells 0x75C4/0x75E4/0x7604). The successor is the
 *           rst-0x28 return path in dispatchBoardClearedInterlude, which reads none of the residual
 *           A/B/C/HL/DE/flags the oracle leaves (the next frame re-dispatches on 0x6388
 *           fresh from memory). SP/PC are not compared — the idiomatic layer drops the
 *           oracle's push16/ret stack+PC bookkeeping; the JS call stack replaces it.
 * NAMES:    SPRITE_OBJ_BLOCK (0x6908), BOARD_ADVANCE_STEP (0x6388, the step selector) from
 *           names.js. 0x385c (ROM figure template) and 0x3b (that template's record-2 X anchor)
 *           stay local hex constants.
 */

import { SPRITE_OBJ_BLOCK, BOARD_ADVANCE_STEP } from "./names.js";
import { spawnInterludeHeart } from "./spawnInterludeHeart.js"; // ROM 0x1708 — opening tableau
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js"; // ROM 0x004e — 40-byte template -> 0x6908
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js"; // ROM 0x0038 (rst 0x38) — X column += C

// The +0 (X) byte of record 2 in SPRITE_OBJ_BLOCK (0x6908 + 4*2). Read for the re-anchor.
const RECORD2_X = SPRITE_OBJ_BLOCK + 0x08; // 0x6910
// ROM source of the fixed ten-record figure template; no names.js symbol.
const FIGURE_TEMPLATE = 0x385c;
// The template's own record-2 X (ROM 0x3864). shift is measured relative to it.
const TEMPLATE_ANCHOR_X = 0x3b;

export function begin50mKongRecaptureInterlude(m) {
  const { regs, mem } = m;

  // 1. Opening tableau (silence sound, seed the heart record, blank three tilemap cells,
  //    set the sound priority).
  spawnInterludeHeart(m); // ROM 0x1708

  // 2. Turn record 2's CURRENT X into the re-anchoring shift. Read BEFORE the copy in
  //    step 3 overwrites 0x6910 — the shift must measure the OLD X.
  const shift = (mem.read8(RECORD2_X) - TEMPLATE_ANCHOR_X) & 0xff; // ld a,(0x6910) / sub 0x3b

  // 3. Stamp the fixed ten-record figure template over the sprite-object block.
  regs.hl = FIGURE_TEMPLATE; // ld hl,0x385c
  loadSpriteObjectBlock(m); // ROM 0x004e — ROM[0x385c..] -> SPRITE_OBJ_BLOCK (0x6908, 40 bytes)

  // 4. Shift the X column of all ten records by `shift`, so record 2 returns to its
  //    previous X (0x3b + (oldX - 0x3b) == oldX) and the whole figure with it.
  regs.hl = SPRITE_OBJ_BLOCK; // ld hl,0x6908 — X byte of record 0
  regs.c = shift; // ld c,a
  addToSpriteObjectColumn(m); // ROM 0x0038 (rst 0x38) — X column += shift, all ten records

  // 5. Advance the sequence step so the next frame dispatches the next step.
  mem.write8(BOARD_ADVANCE_STEP, (mem.read8(BOARD_ADVANCE_STEP) + 1) & 0xff); // inc (0x6388)
}
