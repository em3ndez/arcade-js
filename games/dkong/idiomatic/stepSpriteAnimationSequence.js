// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepSpriteAnimationSequence — one step of the interlude's sprite animation: a throttled
 * two-frame flap whose 256-tick sub-counter, on wrap, restamps the base figure and advances
 * to the next sequence step.
 *
 * LIVE-OUT: memory-only.
 */
import {
  SUBSTATE_TIMER,
  SPRITE_OBJ_BLOCK,
  BOARD_ADVANCE_STEP,
  ANIM_STEP_COUNTER,
  SPRITE_BASE_FIGURE_ROM,
  SPRITE_ANIM_FIGURE_A_ROM,
  SPRITE_ANIM_FIGURE_B_ROM,
} from "./names.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";

const X_COLUMN_SHIFT = 0x44;
const HOLD_FRAMES = 0x20;

// Copy the template over SPRITE_OBJ_BLOCK, then bias the X column of all ten records.
function stampFigure(m, templateAddr) {
  loadSpriteObjectBlock(m, templateAddr);
  addToSpriteObjectColumn(m, SPRITE_OBJ_BLOCK, X_COLUMN_SHIFT);
}

export function stepSpriteAnimationSequence(m) {
  const { mem8 } = m;

  const counter = (mem8[ANIM_STEP_COUNTER] + 1) & 0xff;
  mem8[ANIM_STEP_COUNTER] = counter;

  if (counter === 0) {
    // Wrap: stamp the base figure, re-arm the hold timer, advance to the next step.
    stampFigure(m, SPRITE_BASE_FIGURE_ROM);
    mem8[SUBSTATE_TIMER] = HOLD_FRAMES;
    mem8[BOARD_ADVANCE_STEP] = (mem8[BOARD_ADVANCE_STEP] + 1);
    return;
  }

  if ((counter & 0x07) !== 0) return;

  // Every eighth call: stamp one of two alternating frames (counter bit 3 selects).
  stampFigure(m, (counter & 0x08) !== 0 ? SPRITE_ANIM_FIGURE_A_ROM : SPRITE_ANIM_FIGURE_B_ROM);
}
