// SPDX-License-Identifier: GPL-3.0-only
import { loc_20d4 } from "./loc_20d4.js";
import { driveEagleWavePerFrame } from "./driveEagleWavePerFrame.js";
/**
 * runWaveLaunchPhaseFrame — bonus phase 1 body: run the shared per-frame update, then the wave-launch driver.
 *
 * LIVE-OUT: memory only — the phase dispatcher that calls this reads no register back; the wave
 * driver's own result is forwarded straight through as a faithful tail hand-off.
 */

export function runWaveLaunchPhaseFrame(m) {
  loc_20d4(m); //      shared per-frame update
  return driveEagleWavePerFrame(m); // wave-launch driver
}
