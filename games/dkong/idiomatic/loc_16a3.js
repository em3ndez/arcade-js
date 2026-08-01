// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_16a3 — sequence step 0: spawn init, stamp the fixed ten-record figure over the
 * sprite-object block re-anchored to its previous X, then advance the 0x6388 step. ROM 0x16a3.
 *
 * This is index 0 of the rst-0x28 table at ROM 0x1637, dispatched by loc_1615 (the L2
 * board-advance handler for game sub-state 0x600A == 0x16) on the step selector at
 * 0x6388. As the sequence's first step it sets the figure up, then bumps 0x6388 so the
 * next frame runs the next step (0x16bb). In order:
 *
 *   1. loc_1708 (ROM 0x1708) — the "spawn" initializer: silence sound, seed a fixed
 *      4-byte sprite record + the blink-sprite code, paint a 3-cell colour column, set
 *      the sound-priority pair. Input-independent; touches none of the state below.
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
 * NAME KEPT NEUTRAL. The mechanics above are confirmed, and 0x6388 is now the ram.js-confirmed
 * BOARD_ADVANCE_STEP (this routine advances it), but the routine's ROLE name is not promoted:
 * the directly-parallel sibling sub_1654 (same loc_1708 spawn at the same table-index-0
 * position, for the other board-bit group) is likewise kept neutral in this codebase, and the
 * exact figure it spawns is not independently confirmed. Naming this "board-advance figure
 * spawn" would over-assert a role, so it stays loc_16a3 with the understood mechanics in this
 * header for a later promoter.
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
 *           everything loc_1708 writes (sound RAM 0x6080-0x608B, sprite bytes 0x6905 /
 *           0x6A20-0x6A23, colour cells 0x75C4/0x75E4/0x7604). The successor is the
 *           rst-0x28 return path in loc_1615, which reads none of the residual
 *           A/B/C/HL/DE/flags the oracle leaves (the next frame re-dispatches on 0x6388
 *           fresh from memory). SP/PC are not compared — the idiomatic layer drops the
 *           oracle's push16/ret stack+PC bookkeeping; the JS call stack replaces it.
 * NAMES:    SPRITE_OBJ_BLOCK (0x6908), BOARD_ADVANCE_STEP (0x6388, the step selector) from
 *           ram.js. 0x385c (ROM figure template) and 0x3b (that template's record-2 X anchor)
 *           stay local hex constants.
 */

import { SPRITE_OBJ_BLOCK, BOARD_ADVANCE_STEP } from "./ram.js";
import { loc_1708 } from "./loc_1708.js"; // ROM 0x1708 — spawn init
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js"; // ROM 0x004e — 40-byte template -> 0x6908
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js"; // ROM 0x0038 (rst 0x38) — X column += C

// The +0 (X) byte of record 2 in SPRITE_OBJ_BLOCK (0x6908 + 4*2). Read for the re-anchor.
const RECORD2_X = SPRITE_OBJ_BLOCK + 0x08; // 0x6910
// ROM source of the fixed ten-record figure template; no ram.js symbol.
const FIGURE_TEMPLATE = 0x385c;
// The template's own record-2 X (ROM 0x3864). shift is measured relative to it.
const TEMPLATE_ANCHOR_X = 0x3b;

export function loc_16a3(m) {
  const { regs, mem } = m;

  // 1. Spawn init (silence sound, seed sprite record + colour column + sound priority).
  loc_1708(m); // ROM 0x1708

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
