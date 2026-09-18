// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepSpriteAnimationSequence — one step of the interlude's sprite animation: a throttled
 * two-frame flap whose 256-tick sub-counter, on wrap, restamps the base figure and advances
 * to the next sequence step.
 *
 * LIVE-OUT: memory-only.
 */
import { SUBSTATE_TIMER, SPRITE_OBJ_BLOCK, BOARD_ADVANCE_STEP } from "./names.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";

const ANIM_COUNTER = 0x6390; // per-call sub-counter; wraps 0xFF->0x00 every 256 calls

const FRAME_A = 0x39cf; // counter bit 3 SET
const FRAME_B = 0x39f7; // counter bit 3 CLEAR
const BASE_FIGURE = 0x385c; // re-stamped on the wrap

const X_COLUMN_SHIFT = 0x44;
const HOLD_FRAMES = 0x20;

// Copy the template over SPRITE_OBJ_BLOCK, then bias the X column of all ten records.
function stampFigure(m, templateAddr) {
  const { regs } = m;
  loadSpriteObjectBlock(m, templateAddr);
  regs.hl = SPRITE_OBJ_BLOCK;
  regs.c = X_COLUMN_SHIFT;
  addToSpriteObjectColumn(m);
}

export function stepSpriteAnimationSequence(m) {
  const { mem8 } = m;

  const counter = (mem8[ANIM_COUNTER] + 1) & 0xff;
  mem8[ANIM_COUNTER] = counter;

  if (counter === 0) {
    // Wrap: stamp the base figure, re-arm the hold timer, advance to the next step.
    stampFigure(m, BASE_FIGURE);
    mem8[SUBSTATE_TIMER] = HOLD_FRAMES;
    mem8[BOARD_ADVANCE_STEP] = (mem8[BOARD_ADVANCE_STEP] + 1);
    return;
  }

  if ((counter & 0x07) !== 0) return;

  // Every eighth call: stamp one of two alternating frames (counter bit 3 selects).
  stampFigure(m, (counter & 0x08) !== 0 ? FRAME_A : FRAME_B);
}
