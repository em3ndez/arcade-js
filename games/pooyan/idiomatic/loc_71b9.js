// SPDX-License-Identifier: GPL-3.0-only
import { runEagleApproachPhaseFrame } from "./runEagleApproachPhaseFrame.js";
import { runWaveLaunchPhaseFrame } from "./runWaveLaunchPhaseFrame.js";
import { clearWaveStateAndArenaOnHoldExpiry } from "./clearWaveStateAndArenaOnHoldExpiry.js";
import { loc_02ef } from "./loc_02ef.js";
import { WAVE_OUTER_PHASE } from "./names.js";
/**
 * loc_71b9 — bonus/eagle-stage phase dispatcher. Selects a phase handler by the outer wave phase, then
 * runs the shared epilogue the handler returned into (which returns to our caller). LIVE-OUT: memory only.
 */
export function loc_71b9(m) {
  switch (m.mem8[WAVE_OUTER_PHASE]) {
    case 0: runEagleApproachPhaseFrame(m); break;
    case 1: runWaveLaunchPhaseFrame(m); break;
    case 2: clearWaveStateAndArenaOnHoldExpiry(m); break;
    default:
      throw new Error("loc_71b9: bonus/eagle phase > 2 (guard-slack; the table has 3 entries)");
  }
  return loc_02ef(m); // shared epilogue the handler returned into
}
