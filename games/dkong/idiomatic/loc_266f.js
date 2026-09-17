// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_266f — force object 2's step-direction latch negative unless its sign bit is already
 * set, then run the shared publish/animate tail. One arm of the 50m object-2 update.
 *
 * LIVE-OUT: memory-only — the latch, plus everything the shared tail writes.
 */

import { M50_OBJ2_STEP_DIR } from "./names.js";
import { loc_264c } from "./loc_264c.js";

export function loc_266f(m) {
  const { mem8 } = m;

  if ((mem8[M50_OBJ2_STEP_DIR] & 0x80) === 0) {
    mem8[M50_OBJ2_STEP_DIR] = 0xff;
  }
  return loc_264c(m);
}
