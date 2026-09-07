// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveSoundFrameAndScanInput — the per-frame audio-and-input service.
 *
 * WHAT IT IS
 *   The main-loop step that runs the whole sound driver for the frame, keeps the watchdog happy, then
 *   reads the coin-door/service input port and begins the input-scan chain.
 *
 * ROLE IN THE MACHINE
 *   This is the GAME_STATE A==1 branch of dispatchSelfTestMode. It ticks the sound driver (driveSoundFrame,
 *   0x16f5) and the once-every-other-frame decaying sweep (driveDecayingSoundSweep, 0x16a6), pets the
 *   hardware watchdog by reading the pitch latch, and samples input port IN0 (0x6000). If any of IN0's
 *   "arm" bits (7, 1, 0 — mask 0x83) is pressed it raises the pitch-ramp arm cell loc_41c9, which is what
 *   the rising-glide voice inside the driver watches for. It then falls through into the input-scan chain,
 *   handing the raw IN0 byte on so the chain can run its downstream IN0|IN1 bit tests.
 *
 * ROM 0x1c3a.  Grounding: [seen].
 *
 * LIVE-OUT: the full sound driver's hardware writes; loc_41c9 possibly raised; whatever the tail
 *   input-scan chain (requestSoundOnInput1AndContinueScan, 0x1c50) returns.
 */
import { IN0, SOUND_PITCH_W, loc_41c9 } from "./names.js";
import { driveSoundFrame } from "./driveSoundFrame.js";
import { driveDecayingSoundSweep } from "./driveDecayingSoundSweep.js";
import { requestSoundOnInput1AndContinueScan } from "./requestSoundOnInput1AndContinueScan.js";

const IN0_ARM_MASK = 0x83; // IN0 bits 7, 1, 0 -> arm the pitch-ramp cell

export function driveSoundFrameAndScanInput(m) {
  const { mem8 } = m;

  // Compose and latch all sound for this frame, then run the decaying-sweep effect (which acts on
  // alternate frames of its own accord).
  driveSoundFrame(m);
  driveDecayingSoundSweep(m);

  // Reading the pitch latch address kicks the hardware watchdog so the board does not reset.
  mem8[SOUND_PITCH_W]; // watchdog pet (value discarded)

  // Sample the input port once and keep the raw byte: it both arms the pitch ramp here and feeds the
  // scan chain's downstream bit tests below.
  const in0 = mem8[IN0]; // raw IN0, kept for the scan chain's downstream bit tests
  // If any arm bit (7/1/0) is pressed, raise the pitch-ramp arm cell so the driver's rising-glide voice
  // fires next frame.
  if (in0 & IN0_ARM_MASK) mem8[loc_41c9] = 1;

  // Fall through into the input scan chain, handing it the raw IN0 (the Z80 kept it in B for the chain).
  return requestSoundOnInput1AndContinueScan(m, in0);
}
