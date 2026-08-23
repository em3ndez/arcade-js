// SPDX-License-Identifier: GPL-3.0-only
import { loc_2329 } from "./loc_2329.js";
import { loc_2101 } from "./loc_2101.js";
import { loc_2563 } from "./loc_2563.js";
import { loc_25a6 } from "./loc_25a6.js";
import { loc_308b } from "./loc_308b.js";
import { loc_241e } from "./loc_241e.js";
import {
  PLAY_MODE_LATCH,
  GRAB_ACTIVE_FLAG,
  HISCORE_TABLE_CORRUPT_FLAG,
  TAMPER_STRIKES_TERMINATOR,
  ACTOR_TABLE,
} from "./names.js";

/**
 * loc_20d4 — per-frame object-update gate then the fixed helper chain.
 *
 * While the play-mode latch is idle, a set grab flag hands the frame to the lead-actor driver.
 * While the latch is busy the grab flag is cleared and, if the corruption pair is both set, the
 * frame is handed off the same way. Otherwise it seeds the actor table and runs the five per-frame
 * sub-passes in order, then returns.
 *
 * SEATING: balanced ret, or a tail into the lead-actor driver.
 * LIVE-OUT: none — a void driver; the caller reads nothing back.
 */

export function loc_20d4(m) {
  const { mem8 } = m;

  if (mem8[PLAY_MODE_LATCH] === 0) {
    if (mem8[GRAB_ACTIVE_FLAG] !== 0) return loc_241e(m); // idle + grab set -> lead-actor driver
  } else {
    mem8[GRAB_ACTIVE_FLAG] = 0; // busy -> clear the grab flag
    if ((mem8[HISCORE_TABLE_CORRUPT_FLAG] & mem8[TAMPER_STRIKES_TERMINATOR]) !== 0) return loc_241e(m);
  }

  loc_2329(m, ACTOR_TABLE);
  loc_2101(m);
  loc_2563(m);
  loc_25a6(m);
  loc_308b(m);
}
