// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceColorCycleSweep — advance the colour-cycle sweep counter one step per frame and
 * dispatch this frame's colour work.
 *
 * The per-frame driver of the attract-screen colour cycle, entered once the colour-cycle
 * active flag and the frame counter agree. It bumps the sweep counter by one and, on the
 * post-increment value, routes the frame's colour work four ways:
 *
 *   - the counter reached its top -> end the sweep (clear the counter and the active flag)
 *     and run this frame's colour work.
 *   - the sprite-object reload gate is nonzero -> the colour-cycle repaint only, with no
 *     sprite-object reload.
 *   - not a 32-frame boundary (and the gate is open) -> the same repaint-only path, on the
 *     in-between frames.
 *   - a 32-frame boundary with the gate open -> reload the 40-byte sprite-object block from a
 *     fixed template, assert a 3-frame sound beat on the colour-cascade event, then run the
 *     full colour cascade.
 *
 * On a boundary the template alternates with the counter's bit 5, so the two templates swap
 * every 32 frames.
 *
 * This routine's only direct writes are the counter step and, on the boundary arm, the sound
 * beat; every colour and sprite write happens further down.
 *
 * LIVE-OUT: memory-only — the counter step plus whatever this frame's colour work paints or
 * reloads.
 */

import { u8 } from "../../../core/int.js";
import { resetColorCycleSweep } from "./resetColorCycleSweep.js";
import { dispatchColorCyclePaint } from "./dispatchColorCyclePaint.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { dispatchColorCascadeByBoard } from "./dispatchColorCascadeByBoard.js";
import { SND_TRIGGER } from "./names.js";

const SWEEP_COUNTER = 0x6390;   // colour-cycle sweep counter — a shared cell with no registry name
const OBJ_RELOAD_GATE = 0x6393; // 0 -> reload the block + full cascade; nonzero -> repaint only
const SWEEP_TOP = 0x80;         // top of the counter's range; reaching it ends the sweep
const BOUNDARY_MASK = 0x1f;     // low 5 bits zero -> a 32-frame boundary
const TEMPLATE_BIT = 0x20;      // counter bit 5: selects which template the boundary reloads from
const TEMPLATE_BIT5_SET = 0x39cf;   // sprite-object template when counter bit 5 is set
const TEMPLATE_BIT5_CLEAR = 0x39f7; // sprite-object template when counter bit 5 is clear

export function advanceColorCycleSweep(m) {
  const { regs, mem } = m;

  // Advance the sweep counter one step; every route reads this new value.
  const counter = u8(mem.read8(SWEEP_COUNTER) + 1);
  mem.write8(SWEEP_COUNTER, counter);

  // Top of the sweep: end it and run this frame's colour work.
  if (counter === SWEEP_TOP) {
    resetColorCycleSweep(m);
    return;
  }

  // Reload suppressed, or not a 32-frame boundary: the colour-cycle repaint only.
  if (mem.read8(OBJ_RELOAD_GATE) !== 0) {
    dispatchColorCyclePaint(m);
    return;
  }
  if ((counter & BOUNDARY_MASK) !== 0) {
    dispatchColorCyclePaint(m);
    return;
  }

  // A 32-frame boundary with the reload gate open: reload the sprite-object block from the
  // template selected by the counter's bit 5, assert the 3-frame sound beat that goes with
  // the colour-cascade event, then run the full cascade.
  regs.hl = (counter & TEMPLATE_BIT) !== 0 ? TEMPLATE_BIT5_SET : TEMPLATE_BIT5_CLEAR;
  loadSpriteObjectBlock(m);
  mem.write8(SND_TRIGGER + 2, 3);
  dispatchColorCascadeByBoard(m);
}
