// SPDX-License-Identifier: GPL-3.0-only
import { loc_9eab } from "./loc_9eab.js";
import { loc_9e5f } from "./loc_9e5f.js";

// Full entry for the per-slot segment step: run the gated bit6-keeper guard first, then
// delegate to the shared mid-entry body (the guard-less entry runs the same body). Slot
// chosen by x; the live-out is whatever the shared body leaves.
export function loc_9e5c(m, x = m.regs.x) {
  loc_9eab(m, x);        // gated per-slot bit6-keeper guard (head work)
  return loc_9e5f(m, x); // shared tail
}
