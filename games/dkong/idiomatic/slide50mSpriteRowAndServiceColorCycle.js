// SPDX-License-Identifier: GPL-3.0-only
/**
 * slide50mSpriteRowAndServiceColorCycle — service the per-frame colour cycle, with a
 * 50m-only sprite-row slide in front of it.
 *
 * Runs once a frame from the colour driver. It first looks at the current board:
 *
 *   - Any board but 50m: nothing special — service the colour cycle, which advances a
 *     running sweep, re-arms one at the frame-counter wrap, or just repaints the colour
 *     column.
 *   - 50m: run the sprite-row slide first, THEN service the colour cycle. The slide does
 *     two things, in order:
 *       1. Shift the X of all ten sprite-object records in SPRITE_OBJ_BLOCK by the 50m
 *          object's published step M50_OBJ1_STEP, moving the whole row of 50m props by
 *          that signed delta.
 *       2. Take the now-shifted X of the third record, subtract a fixed anchor, and store
 *          the result as M50_OBJ_ROW_SHIFT — the X-shift delta the 50m column painter
 *          later adds back into that same X column.
 *
 * A sibling entry runs the same body but reaches the colour-cycle tail on a flag its task
 * runner hands it rather than on the board. Every colour and sprite write beyond the one
 * row-shift store happens inside the callees.
 *
 * NOT CLAIMED: what the ten sprite-objects depict. The template stamped into that block is
 * the same on every board, so it carries no per-board identity.
 *
 * LIVE-OUT: memory-only — the caller services the colour cycle and reads nothing back.
 */

import { BOARD, SPRITE_OBJ_BLOCK, M50_OBJ1_STEP, M50_OBJ_ROW_SHIFT } from "./names.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";
import { serviceColorCycle } from "./serviceColorCycle.js";

// Record 2's X within the sprite-object block, read back after the row shift.
const SPRITE_OBJ_REC2_X = SPRITE_OBJ_BLOCK + 8;

export function slide50mSpriteRowAndServiceColorCycle(m) {
  const { regs, mem } = m;

  // Not 50m: no preamble, just drive the colour cycle.
  if (mem.read8(BOARD) !== 2) {
    serviceColorCycle(m);
    return;
  }

  // 50m slide. Shift the X of all ten sprite-object records by the 50m object's step.
  // The column adder reads the field pointer and the signed delta out of the register
  // image, so both are staged there first.
  regs.hl = SPRITE_OBJ_BLOCK;
  regs.c = mem.read8(M50_OBJ1_STEP);
  addToSpriteObjectColumn(m);

  // Row-shift delta = the (shifted) third record's X byte less 0x3b (8-bit; the store
  // truncates). Consumed by the 50m column painter.
  mem.write8(M50_OBJ_ROW_SHIFT, mem.read8(SPRITE_OBJ_REC2_X) - 0x3b);

  // Fall into the colour cycle.
  serviceColorCycle(m);
}
