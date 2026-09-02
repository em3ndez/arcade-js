// SPDX-License-Identifier: GPL-3.0-only
import { loc_14d8 } from "./loc_14d8.js";
import { loc_1597 } from "./loc_1597.js";

// Run the state-2 handler, then tail into the fleet edge/direction update.
// Live-out: RAM only; the callers ignore the result.
export function loc_190a(m) {
  loc_14d8(m);
  return loc_1597(m);
}
