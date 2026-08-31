// SPDX-License-Identifier: GPL-3.0-only
import { dispatchPerFrameActorUpdatePasses } from "./dispatchPerFrameActorUpdatePasses.js";
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
  dispatchPerFrameActorUpdatePasses(m);
}
