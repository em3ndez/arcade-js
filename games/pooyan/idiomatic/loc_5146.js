// SPDX-License-Identifier: GPL-3.0-only
import { loc_52f6 } from "./loc_52f6.js";
import { loc_5150 } from "./loc_5150.js";
import { loc_5334 } from "./loc_5334.js";
/**
 * loc_5146 — boot-frontier trampoline: run three sub-passes in order, then return.
 * LIVE-OUT: none — the callees leave no register this routine or its caller reads.
 */
export function loc_5146(m) {
  loc_5150(m); // script-advance
  loc_52f6(m); // gated slot sweep
  loc_5334(m); // countdown/expiry
}
