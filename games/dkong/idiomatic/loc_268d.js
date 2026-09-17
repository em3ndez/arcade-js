// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_268d — publish object-3's ±1 step every pass, and on every 32nd frame advance its
 * mirrored sprite pair from the direction latch just reduced. 50m board only.
 *
 * LIVE-OUT: memory-only — the published step shadow every pass, and object-3's sprite-pair
 * counters on the 32nd-frame arm.
 */

import { M50_OBJ3_STEP_DIR, M50_OBJ3_STEP, FRAME } from "./names.js";
import { signStepHalfRate } from "./signStepHalfRate.js";
import { loc_26a6 } from "./loc_26a6.js";

const OBJ3_SPRITE_PAIR = 0x69f4;

export function loc_268d(m) {
  const { regs, mem8 } = m;

  regs.hl = M50_OBJ3_STEP_DIR;
  signStepHalfRate(m);
  mem8[M50_OBJ3_STEP] = regs.a;

  if ((mem8[FRAME] & 0x1f) !== 0x02) return;

  regs.hl = OBJ3_SPRITE_PAIR;
  regs.de = M50_OBJ3_STEP_DIR;
  loc_26a6(m);
}
