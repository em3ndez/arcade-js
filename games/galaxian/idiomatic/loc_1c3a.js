// SPDX-License-Identifier: GPL-3.0-only
// loc_1c3a — the per-frame main-loop input step. Run the sound driver's per-frame tick and the
// once-every-other-frame decaying sweep, pet the watchdog, then read IN0: if any of its arm bits
// (7, 1, 0) is set, raise the pitch-ramp arm cell; then fall through into the input scan chain,
// handing it the raw IN0 byte for the chain's downstream IN0|IN1 bit tests.
import { IN0, SOUND_PITCH_W, loc_41c9 } from "./names.js";
import { driveSoundFrame } from "./driveSoundFrame.js";
import { driveDecayingSoundSweep } from "./driveDecayingSoundSweep.js";
import { requestSoundOnInput1AndContinueScan } from "./requestSoundOnInput1AndContinueScan.js";

const IN0_ARM_MASK = 0x83; // IN0 bits 7, 1, 0 -> arm the pitch-ramp cell

export function loc_1c3a(m) {
  const { mem8 } = m;

  driveSoundFrame(m);
  driveDecayingSoundSweep(m);

  mem8[SOUND_PITCH_W]; // watchdog pet (value discarded)

  const in0 = mem8[IN0]; // raw IN0, kept for the scan chain's downstream bit tests
  if (in0 & IN0_ARM_MASK) mem8[loc_41c9] = 1;

  // Fall through into the input scan chain, handing it the raw IN0.
  return requestSoundOnInput1AndContinueScan(m, in0);
}
