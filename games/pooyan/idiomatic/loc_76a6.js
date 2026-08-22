// SPDX-License-Identifier: GPL-3.0-only
import { loc_4006 } from "./loc_4006.js";
import { OBJECT_DRAWN_FLAG } from "./names.js";

/**
 * loc_76a6 — animation-tick state 2.
 *
 * A gate: while the object-drawn flag is set the entry is held (nothing steps). Once it is clear the
 * entry's animation steps. Either way the walk continues — this handler never aborts it.
 *
 * LIVE-OUT: none in registers — always returns true (keep walking). Memory: only the stepped
 * animation, and only while the drawn flag is clear.
 */
export function loc_76a6(m, ix = m.regs.ix) {
  const { mem8 } = m;

  if (mem8[OBJECT_DRAWN_FLAG] !== 0) return true; // gate closed -> hold
  loc_4006(m, ix); // gate open -> step this entry's animation
  return true;
}
