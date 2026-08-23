// SPDX-License-Identifier: GPL-3.0-only
import { loc_5e78 } from "./loc_5e78.js";
import { loc_5f6a } from "./loc_5f6a.js";
import { loc_602f } from "./loc_602f.js";
import { loc_6368 } from "./loc_6368.js";
import { loc_5df7 } from "./loc_5df7.js";
import { flagTamperOnRound5ChecksumMiss } from "./flagTamperOnRound5ChecksumMiss.js";
import { loc_5d4d } from "./loc_5d4d.js";
import { loc_5b86 } from "./loc_5b86.js";
import { loc_6404 } from "./loc_6404.js";
import { loc_5d0b } from "./loc_5d0b.js";
import { loc_5b2c } from "./loc_5b2c.js";
/**
 * loc_5ae4 — master per-frame actor updater.
 *
 * Invokes the eleven per-frame subsystem handlers in a fixed order, then returns. A straight
 * sequencer: no branches and no register hand-off — each callee reads and writes work RAM and
 * returns void, and this driver consumes none of their results.
 *
 * LIVE-OUT: none — a void driver; the caller resumes on its own state.
 */
export function loc_5ae4(m) {
  loc_5e78(m); // odd-round actor sweep
  loc_5f6a(m);
  loc_602f(m);
  loc_6368(m);
  loc_5df7(m);
  flagTamperOnRound5ChecksumMiss(m); // round-5 checksum tamper tally
  loc_5d4d(m);
  loc_5b86(m);
  loc_6404(m); // two-pass actor collision driver
  loc_5d0b(m);
  loc_5b2c(m); // end-of-wave object-table cleanup
}
