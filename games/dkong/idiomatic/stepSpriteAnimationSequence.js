// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepSpriteAnimationSequence — advance one step of the interlude's sprite animation sequence: a
 * throttled two-frame flap whose 256-tick sub-counter, on wrap, restamps the base figure and hands
 * off to the next sequence step.
 *
 * One index of the interlude's step-selector state machine, whose sibling steps each render one
 * stage and then advance the selector. This step is the animated HOLD before that hand-off. Each
 * call:
 *
 *   1. Bumps a per-call sub-counter (8-bit wrap). Most of the time nothing more happens.
 *   2. On every EIGHTH call — low three bits zero — it stamps one animation frame: block-copy a
 *      40-byte, ten-record sprite-object template over SPRITE_OBJ_BLOCK, then shift the X column of
 *      all ten records right by 0x44. Bit 3 of the counter selects between TWO templates, so the
 *      figure alternates between two frames every eight ticks: a two-frame flap at 1/8 rate.
 *   3. On the counter's WRAP, once per 256 calls, it instead stamps the BASE figure, re-arms the
 *      sub-state hold timer, and advances BOARD_ADVANCE_STEP so the NEXT frame dispatches the next
 *      step of the sequence.
 *
 * Both stamp paths share one idiom: load a fixed template over the whole sprite-object block, then
 * bias its X column. The only thing that varies is which template — frame A, frame B, or the base
 * figure.
 *
 * WHAT THE NAME CLAIMS. The throttle, the two-frame alternation and the hand-off are all derivable
 * from the body. NOT CLAIMED: what the figure IS, or what the two alternating frames depict — from
 * this file the three templates are opaque.
 *
 * Reads: the sub-counter and BOARD_ADVANCE_STEP. Writes: the sub-counter on every call; on a stamp
 * the ten SPRITE_OBJ_BLOCK records; on the wrap also SUBSTATE_TIMER and BOARD_ADVANCE_STEP.
 * LIVE-OUT: memory-only.
 */
import { SUBSTATE_TIMER, SPRITE_OBJ_BLOCK, BOARD_ADVANCE_STEP } from "./names.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";

const ANIM_COUNTER = 0x6390; // per-call sub-counter; wraps 0xFF->0x00 every 256 calls

// The sprite-object-block templates — each 40 bytes, ten 4-byte hardware sprite records.
const FRAME_A = 0x39cf; // animation frame A — counter bit 3 SET
const FRAME_B = 0x39f7; // animation frame B — counter bit 3 CLEAR
const BASE_FIGURE = 0x385c; // the sequence-start figure, re-stamped on the wrap

const X_COLUMN_SHIFT = 0x44; // added into the X byte of all ten records after each stamp
const HOLD_FRAMES = 0x20; // sub-state hold timer re-armed on wrap

// Stamp one ten-record figure: copy the template over SPRITE_OBJ_BLOCK, then bias the X column
// of all ten records right by 0x44. Both callees take their inputs in registers.
function stampFigure(m, templateAddr) {
  const { regs } = m;
  regs.hl = templateAddr; // the block copy takes its source here
  loadSpriteObjectBlock(m); // 40-byte template -> SPRITE_OBJ_BLOCK
  regs.hl = SPRITE_OBJ_BLOCK; // the X byte of record 0
  regs.c = X_COLUMN_SHIFT;
  addToSpriteObjectColumn(m); // X column += the shift, across all ten records
}

export function stepSpriteAnimationSequence(m) {
  const { mem } = m;

  // Bump the per-call sub-counter (8-bit wrap). Wrap (0xFF -> 0x00) is the hand-off tick.
  const counter = (mem.read8(ANIM_COUNTER) + 1) & 0xff;
  mem.write8(ANIM_COUNTER, counter);

  if (counter === 0) {
    // WRAP: stamp the base figure, re-arm the hold timer, advance to the next step.
    stampFigure(m, BASE_FIGURE);
    mem.write8(SUBSTATE_TIMER, HOLD_FRAMES);
    mem.write8(BOARD_ADVANCE_STEP, (mem.read8(BOARD_ADVANCE_STEP) + 1) & 0xff); // -> the next step
    return;
  }

  // Not the eighth call -> nothing to draw this frame.
  if ((counter & 0x07) !== 0) return;

  // Every eighth call: stamp one of two alternating frames (counter bit 3 selects).
  stampFigure(m, (counter & 0x08) !== 0 ? FRAME_A : FRAME_B);
}
