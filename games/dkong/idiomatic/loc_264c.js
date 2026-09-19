// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_264c — reduce object-2's direction latch to a ±1 unit step and publish both polarities
 * to the mover's shadow bytes (positive to M50_OBJ2_STEP_POS, negated to M50_OBJ2_STEP_NEG);
 * the helper rewrites the latch only on odd frames, so the shadows pulse 0 / ±1. Then, every
 * 32nd frame (low 5 bits of FRAME zero, an even frame), advance object-2's mirrored sprite-code
 * pair, its direction from the reverse timer, and re-stamp the low cell from the high cell with
 * the flip bit cleared.
 *
 * LIVE-OUT: memory-only — the two published shadows on every pass, plus the sprite-code pair
 * on the 32nd-frame arm.
 */

import { u8 } from "../../../core/int.js";
import {
  FRAME,
  M50_OBJ2_REVERSE_TIMER,
  M50_OBJ2_SPRITE_PAIR,
  M50_OBJ2_SPRITE_PAIR_LOW,
  M50_OBJ2_STEP_DIR,
  M50_OBJ2_STEP_NEG,
  M50_OBJ2_STEP_POS,
} from "./names.js";
import { signStepHalfRate } from "./signStepHalfRate.js";
import { loc_26a6 } from "./loc_26a6.js";

// Object-2's mirrored sprite-code pair: low cell (base+1), high cell (base+5).

export function loc_264c(m) {
  const { regs, mem8 } = m;

  signStepHalfRate(m, M50_OBJ2_STEP_DIR);
  const step = regs.a;
  mem8[M50_OBJ2_STEP_POS] = step;
  mem8[M50_OBJ2_STEP_NEG] = u8(-step);

  if ((mem8[FRAME] & 0x1f) !== 0) return;

  regs.hl = M50_OBJ2_SPRITE_PAIR;
  regs.de = M50_OBJ2_REVERSE_TIMER;
  loc_26a6(m);
  const pairHigh = regs.a;

  mem8[M50_OBJ2_SPRITE_PAIR_LOW] = pairHigh & 0x7f; // clear the horizontal-flip bit
}
