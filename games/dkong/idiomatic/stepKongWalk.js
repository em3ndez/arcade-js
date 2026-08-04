// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepKongWalk — drive the first of the timed board objects, then slide a ten-sprite figure one
 * step along X by whatever that object published.
 *
 * The motion tail of the board-cleared interlude in which a large figure walks across the
 * screen. Its sibling arms watch one record's X against two limits to decide when the figure
 * has reached a boundary; this routine is what actually moves it. One tick of that motion is
 * exactly three steps:
 *
 *   1. Advance the first timed board object. That ticks its even-frame countdown, reloading it
 *      and reversing its step-direction sign on the decrement that REACHES zero — the real
 *      underflow past zero is the no-reverse case — republishes its signed per-frame step, and
 *      every 32nd frame advances its mirrored sprite-animation pair.
 *   2. Take that freshly published step as the shift amount.
 *   3. Add the shift to the X field of each of the ten records in the sprite-object block,
 *      sliding the whole figure left or right by the object's step.
 *
 * The published step is 0 on even frames, so the figure holds still and only the object's
 * internal state advances; on odd frames it slides one pixel either way.
 *
 * WHICH FIGURE IT IS: the interlude step that runs immediately before this stamps a ten-record
 * figure template over this same sprite-object block and then points the interlude's step
 * selector at the family of arms that all end here. So the group this routine slides is that
 * single stamped figure — same block, same template.
 *
 * WHAT THE NAME DOES NOT CLAIM: that the figure is Kong on measured bytes. That reading comes
 * from looking at the interlude, not from measuring the sprite data, and no record of the block
 * has been identified as Pauline.
 *
 * Reads: the published step of the first timed object. Writes: that object's own state through
 * the driver, and the X field of all ten records in the sprite-object block.
 *
 * LIVE-OUT: memory-only. This is the tail of the interlude family and the dispatcher above it
 * reads no register it leaves.
 */

import { SPRITE_OBJ_BLOCK, M50_OBJ1_STEP } from "./names.js";
import { loc_2602 } from "./loc_2602.js";
import { addStrided } from "./addStrided.js";

export function stepKongWalk(m) {
  const { regs, mem } = m;

  // 1. Advance the first timed object; this REPUBLISHES its signed per-frame step.
  loc_2602(m);

  // 2. The step just published becomes the addend for the block shift.
  regs.c = mem.read8(M50_OBJ1_STEP);

  // 3. Add that step to the X field of each of the ten records in the sprite-object block.
  regs.de = 0x0004; // stride — one whole 4-byte record
  regs.b = 0x0a; // ten records
  regs.hl = SPRITE_OBJ_BLOCK;
  addStrided(m);
}
