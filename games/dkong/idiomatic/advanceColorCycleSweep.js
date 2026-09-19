// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceColorCycleSweep — per-frame driver of the attract colour cycle. Bumps the sweep counter
 * and routes this frame's colour work: at the top of range end the sweep; with the reload gate set
 * or off a 32-frame boundary do the repaint only; on a boundary with the gate open reload the
 * 40-byte sprite-object block from a bit-5-selected template, assert a 3-frame sound beat, then run
 * the full colour cascade.
 *
 * LIVE-OUT: memory-only — the counter step plus whatever this frame's colour work paints or reloads.
 */

import { u8 } from "../../../core/int.js";
import { resetColorCycleSweep } from "./resetColorCycleSweep.js";
import { dispatchColorCyclePaint } from "./dispatchColorCyclePaint.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { dispatchColorCascadeByBoard } from "./dispatchColorCascadeByBoard.js";
import { SND_TRIGGER, ANIM_STEP_COUNTER, loc_6393 } from "./names.js";

const SWEEP_TOP = 0x80;
const BOUNDARY_MASK = 0x1f; // low 5 bits zero -> a 32-frame boundary
const TEMPLATE_BIT = 0x20; // counter bit 5: selects which template the boundary reloads from
const TEMPLATE_BIT5_SET = 0x39cf;
const TEMPLATE_BIT5_CLEAR = 0x39f7;

export function advanceColorCycleSweep(m) {
  const { regs, mem8 } = m;

  const counter = u8(mem8[ANIM_STEP_COUNTER] + 1);
  mem8[ANIM_STEP_COUNTER] = counter;

  if (counter === SWEEP_TOP) {
    resetColorCycleSweep(m);
    return;
  }

  if (mem8[loc_6393] !== 0) {
    dispatchColorCyclePaint(m);
    return;
  }
  if ((counter & BOUNDARY_MASK) !== 0) {
    dispatchColorCyclePaint(m);
    return;
  }

  loadSpriteObjectBlock(m, (counter & TEMPLATE_BIT) !== 0 ? TEMPLATE_BIT5_SET : TEMPLATE_BIT5_CLEAR);
  mem8[SND_TRIGGER + 2] = 3;
  dispatchColorCascadeByBoard(m);
}
