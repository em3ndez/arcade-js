// SPDX-License-Identifier: GPL-3.0-only
/**
 * marioActiveGuard — true when Mario is alive (MARIO_ACTIVE bit 0 set), so callers can early-return
 * when he is dead: `if (!marioActiveGuard(m)) return;`.
 *
 * LIVE-OUT: the boolean only; no memory written.
 */

import { MARIO_ACTIVE } from "./names.js";

export function marioActiveGuard(m) {
  // Proceed exactly when bit 0 is SET; a near-identical sibling guards on the CLEAR sense.
  return (m.mem8[MARIO_ACTIVE] & 0x01) !== 0;
}
