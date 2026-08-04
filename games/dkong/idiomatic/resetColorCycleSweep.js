// SPDX-License-Identifier: GPL-3.0-only
/**
 * resetColorCycleSweep — end the colour-cycle sweep when its counter tops out, then continue the
 * frame's colour work.
 *
 * The colour-cycle sweep counter climbs one step per frame and reaches its top of 0x80 once per
 * sweep; the driver that does the increment jumps here on the frame it wraps. This routine ENDS
 * the sweep — clear the counter back to 0 and lower the colour-cycle active flag — and then
 * continues into the SAME per-frame colour work the non-wrap path runs, selected by the
 * sprite-object reload gate. It is the reset/end half only: what STARTS the next sweep is a
 * re-arm at the next FRAME wrap, elsewhere — hence "reset", not "restart".
 *
 *   - reload gate NONZERO -> straight into the colour-cycle repaint, skipping both the
 *     sprite-object block reload and the cascade's per-board sprite-column shift.
 *   - reload gate ZERO    -> reload the 40-byte sprite-object block from its template, then run
 *     the full colour-cascade dispatch, which additionally shifts the sprite-object column by
 *     board before the repaint.
 *
 * So the top-of-sweep frame both resets the counter and re-seeds the sprite-object block, unless
 * the gate suppresses the reload. This routine's own writes are just the two counter clears; the
 * block reload and every colour/sprite write happen in the callees.
 *
 * The block loader takes its copy SOURCE in a register rather than as an argument, so on the
 * reload arm this routine loads the template address into that register before calling it. The
 * repaint and cascade calls need no such setup: both read their inputs (the board and the sweep
 * counter) straight out of RAM.
 *
 * LIVE-OUT: memory-only — the two counter clears plus whatever the callees paint or reload.
 * Control returns to a caller that reads no register before overwriting it.
 */

import { COLOUR_CYCLE_ACTIVE } from "./names.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { dispatchColorCyclePaint } from "./dispatchColorCyclePaint.js";
import { dispatchColorCascadeByBoard } from "./dispatchColorCascadeByBoard.js";

// The colour-cycle sweep counter. It has no shared name because it is also the how-high
// interlude's animation stepper, so a colour-specific name would be wrong half the time.
const SWEEP_COUNTER = 0x6390;
// 0 -> reload the sprite-object block + run the full cascade; nonzero -> repaint only. Shared
// with other subsystems, so it too is file-local.
const OBJ_RELOAD_GATE = 0x6393;
// The sprite-object template copied into the block on the reload arm.
const OBJ_TEMPLATE = 0x385c;

export function resetColorCycleSweep(m) {
  const { regs, mem } = m;

  // Top of the sweep: restart the counter and lower the colour-cycle active flag.
  mem.write8(SWEEP_COUNTER, 0);
  mem.write8(COLOUR_CYCLE_ACTIVE, 0);

  // Gate set: skip the sprite-object reload and go straight to the colour-cycle repaint.
  if (mem.read8(OBJ_RELOAD_GATE) !== 0) {
    dispatchColorCyclePaint(m);
    return;
  }

  // Gate clear: reload the sprite-object block from its template, then run the full cascade.
  regs.hl = OBJ_TEMPLATE; // the block loader reads its source pointer from a register
  loadSpriteObjectBlock(m);
  dispatchColorCascadeByBoard(m);
}
