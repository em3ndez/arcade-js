// SPDX-License-Identifier: GPL-3.0-only
/**
 * begin50mKongRecaptureInterlude — open the 50m board-cleared interlude: spawn the heart, stamp
 * the fixed ten-record figure over the sprite-object block re-anchored to its current X, then
 * move the sequence on.
 *
 * The first step of the even-board branch of the board-cleared interlude that plays between
 * boards. As the sequence's first step it sets the figure up, then bumps the step selector so
 * the next frame runs the following step. In order:
 *
 *   1. Spawn the interlude's opening tableau: silence the sound, seed the whole-heart sprite
 *      record and the blink sprite's code, blank three tilemap cells, and set the
 *      sound-priority pair. It is input-independent and touches none of the state below.
 *
 *   2. Capture record 2's CURRENT on-screen X and turn it into a shift relative to the
 *      template's own anchor. This read happens BEFORE the copy below overwrites that byte —
 *      the ordering is the whole point, so the shift measures the OLD X, not the template's.
 *
 *   3. Copy the fixed forty-byte ten-record figure template over SPRITE_OBJ_BLOCK.
 *
 *   4. Add the shift into the X byte of all ten records. Record 2 therefore lands back on its
 *      previous X, and the whole figure is carried with it: the figure is re-stamped from its
 *      template but keeps its horizontal position across the re-stamp.
 *
 *   5. Advance the sequence step.
 *
 * WHY THE RE-ANCHOR IS HERE and not on the odd boards: during 50m play a per-frame slide keeps
 * shifting this same X column, so the figure can be anywhere along it when the board ends.
 * Stamping the template raw would teleport it.
 *
 * WHAT THE NAME DOES NOT CLAIM: which record of the ten-record block is which. No record is
 * identified as Pauline — that separation was never made — so the name says who is re-stamped,
 * not who is carried.
 *
 * LIVE-OUT: memory-only — the sprite-object block, the step selector, and everything the
 * opening tableau writes (the sound cells, two sprite records and three tilemap cells). Nothing
 * reads a value back: the next frame re-dispatches on the step selector, fresh from memory.
 */

import { SPRITE_OBJ_BLOCK, BOARD_ADVANCE_STEP } from "./names.js";
import { spawnInterludeHeart } from "./spawnInterludeHeart.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";

// Record 2's X within SPRITE_OBJ_BLOCK. Read for the re-anchor.
const RECORD2_X = SPRITE_OBJ_BLOCK + 0x08;
// Source of the fixed ten-record figure template.
const FIGURE_TEMPLATE = 0x385c;
// The template's own record-2 X; the shift is measured relative to it.
const TEMPLATE_ANCHOR_X = 0x3b;

export function begin50mKongRecaptureInterlude(m) {
  const { regs, mem } = m;

  // 1. Opening tableau (silence sound, seed the heart record, blank three tilemap cells,
  //    set the sound priority).
  spawnInterludeHeart(m);

  // 2. Turn record 2's CURRENT X into the re-anchoring shift. Read BEFORE the copy in
  //    step 3 overwrites that byte — the shift must measure the OLD X.
  const shift = (mem.read8(RECORD2_X) - TEMPLATE_ANCHOR_X) & 0xff;

  // 3. Stamp the fixed ten-record figure template over the sprite-object block. The copy
  //    reads its source out of the register image.
  regs.hl = FIGURE_TEMPLATE;
  loadSpriteObjectBlock(m);

  // 4. Shift the X column of all ten records by `shift`, so record 2 returns to its
  //    previous X and the whole figure comes with it. The column adder reads the field
  //    pointer and the delta out of the register image.
  regs.hl = SPRITE_OBJ_BLOCK; // X byte of record 0
  regs.c = shift;
  addToSpriteObjectColumn(m);

  // 5. Advance the sequence step so the next frame dispatches the next step.
  mem.write8(BOARD_ADVANCE_STEP, (mem.read8(BOARD_ADVANCE_STEP) + 1) & 0xff);
}
