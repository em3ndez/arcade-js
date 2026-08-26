// SPDX-License-Identifier: GPL-3.0-only
import { dispatchLaunchState } from "./dispatchLaunchState.js";
import { spawnTargetActorOnLaunchTrigger } from "./spawnTargetActorOnLaunchTrigger.js";
import { stepActiveTargetActorRecords } from "./stepActiveTargetActorRecords.js";
/**
 * runLaunchAndTargetActorPipeline — boot-frontier sub-dispatch.
 *
 * Runs the three frontier sub-passes in order, once per call: the launch-sequence state driver,
 * the one-shot slot-arming advance, and the paired-slot integrity scan; then returns.
 *
 * LIVE-OUT: none — a void sequencer; each sub-pass acts on memory and the caller reads nothing back.
 */
export function runLaunchAndTargetActorPipeline(m) {
  dispatchLaunchState(m);
  spawnTargetActorOnLaunchTrigger(m);
  stepActiveTargetActorRecords(m);
}
