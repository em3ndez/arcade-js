// SPDX-License-Identifier: GPL-3.0-only
import { LAUNCH_STATE } from "./names.js";
import { armLaunchAndAdvanceToHunterSpawn } from "./armLaunchAndAdvanceToHunterSpawn.js";
import { spawnEnemyTargetOrAnimateLaunchFlipTile } from "./spawnEnemyTargetOrAnimateLaunchFlipTile.js";
import { spawnHunterIntoTableAndAdvanceLaunch } from "./spawnHunterIntoTableAndAdvanceLaunch.js";
import { advanceLaunchOnDelayAndClearHunterRecord } from "./advanceLaunchOnDelayAndClearHunterRecord.js";
import { idleLaunchStateNoop } from "./idleLaunchStateNoop.js";

/**
 * dispatchLaunchState — per-frame driver for the launch-sequence state machine.
 *
 * Selects a handler by the low three bits of the launch state and runs it; the selected handler
 * returns straight to this routine's caller (a tail dispatch). Five sub-states.
 *
 * LIVE-OUT: none — a void per-frame dispatch; the caller reads nothing back.
 */
export function dispatchLaunchState(m) {
  switch (m.mem8[LAUNCH_STATE] & 0x07) {
    case 0: return armLaunchAndAdvanceToHunterSpawn(m);
    case 1: return spawnEnemyTargetOrAnimateLaunchFlipTile(m);
    case 2: return spawnHunterIntoTableAndAdvanceLaunch(m);
    case 3: return advanceLaunchOnDelayAndClearHunterRecord(m);
    case 4: return idleLaunchStateNoop(m);
  }
}
