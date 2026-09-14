// SPDX-License-Identifier: GPL-3.0-only
import { seedFrameControlTimers } from "./seedFrameControlTimers.js";
import { reseedStateTables } from "./reseedStateTables.js";
import { loc_902b } from "./loc_902b.js";

// Startup init: run the two seed routines in order, then tail-delegate to the main init.
export function loc_9025(m) {
  seedFrameControlTimers(m);
  reseedStateTables(m);
  return loc_902b(m);
}
