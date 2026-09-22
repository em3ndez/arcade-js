// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b1c — probe Mario's descent landing; on a normal result run the board-gated collision
 * follow-up and hand back a zeroed result pair.
 * The probe's false skip is a two-frame unwind that returns past this routine to its own caller,
 * so the early return propagates it — the follow-up and result pair are exactly what the unwind
 * skips, and on that path the caller reads the probe's own verdict. The follow-up is gated on
 * the board (one board opens it; on the rest it does nothing) and its own skip signal is discarded.
 * RETURNS the descent verdict (the value the airborne handler branches on): the probe's verdict on
 * the unwind, 0 on the normal follow-up path.
 * LIVE-OUT: the two result bytes, read back and branched on by the airborne per-frame handler.
 */

import { probeMarioDescentLanding } from "./probeMarioDescentLanding.js";
import { loc_29af } from "./loc_29af.js";
import { MARIO_ACTIVE } from "./names.js";

export function loc_2b1c(m) {
  const { regs } = m;

  const { skip, verdict } = probeMarioDescentLanding(m, MARIO_ACTIVE);
  if (!skip) return verdict;

  loc_29af(m);
  // The zeroed result pair rides the return; the verdict on the normal follow-up path is 0.
  return (regs.a = 0, regs.b = 0, 0);
}
