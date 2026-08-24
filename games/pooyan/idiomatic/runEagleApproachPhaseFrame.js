// SPDX-License-Identifier: GPL-3.0-only
import { loc_20d4 } from "./loc_20d4.js";
import { advanceEagleApproachAndPaintGridMarker } from "./advanceEagleApproachAndPaintGridMarker.js";

/**
 * runEagleApproachPhaseFrame — bonus phase-0 body.
 *
 * Step the eagle/arrow approach state machine, then run the shared per-frame object update.
 * The state machine leaves no register the update reads back, so no bridging is needed
 * between the two.
 *
 * LIVE-OUT: memory only.
 */
export function runEagleApproachPhaseFrame(m) {
  advanceEagleApproachAndPaintGridMarker(m);
  loc_20d4(m);
}
