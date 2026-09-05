// SPDX-License-Identifier: GPL-3.0-only
// Pitch-ramp arm tick: predecrement the arm counter (a test only). While it stays armed, advance the
// pitch ramp one step; when it reaches its reset point, clear the arm and reload the ramp pair.
import { advanceSoundPitchRamp } from "./advanceSoundPitchRamp.js";
import { loc_41c9, loc_41ca } from "./names.js";

// Reloaded into the {countdown, pitch} pair: countdown 32, pitch 0.
const RAMP_RELOAD = 32;

export function loc_1876(m) {
  const { mem8, mem16 } = m;

  // The arm byte is not stored while it stays nonzero -- the predecrement only picks the branch.
  if (((mem8[loc_41c9] - 1) & 0xff) !== 0) return advanceSoundPitchRamp(m, loc_41c9);

  // Reset point reached: clear the arm and reload the ramp pair.
  mem8[loc_41c9] = 0;
  mem16[loc_41ca] = RAMP_RELOAD;
}
