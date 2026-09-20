// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_268d — publish object-3's ±1 step every pass, and on every 32nd frame advance its
 * mirrored sprite pair from the direction latch just reduced. 50m board only.
 *
 * LIVE-OUT: memory-only — the published step shadow every pass, and object-3's sprite-pair
 * counters on the 32nd-frame arm.
 */

import {
  FRAME,
  M50_OBJ3_SPRITE_PAIR_BASE,
  M50_OBJ3_STEP,
  M50_OBJ3_STEP_DIR,
} from "./names.js";
import { signStepHalfRate } from "./signStepHalfRate.js";
import { loc_26a6 } from "./loc_26a6.js";


export function loc_268d(m) {
  const { mem8 } = m;

  signStepHalfRate(m, M50_OBJ3_STEP_DIR);
  // Recover the ±1 step under the same parity gate the helper uses (0 on even frames).
  const step = (mem8[FRAME] & 0x01) === 0 ? 0x00 : mem8[M50_OBJ3_STEP_DIR];
  mem8[M50_OBJ3_STEP] = step;

  if ((mem8[FRAME] & 0x1f) !== 0x02) return;

  loc_26a6(m, M50_OBJ3_SPRITE_PAIR_BASE, M50_OBJ3_SPRITE_PAIR_BASE & 0xff, M50_OBJ3_STEP_DIR);
}
