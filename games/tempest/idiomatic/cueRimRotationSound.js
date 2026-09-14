// SPDX-License-Identifier: GPL-3.0-only
import { requestSoundIfEnabled } from "./requestSoundIfEnabled.js";

/**
 * cueRimRotationSound — request the spinner/rim-rotation click. ROM 0xccb5.
 *
 * Role in the machine: the player rotates the blaster around the rim of the tube with the spinner.
 * Each time the blaster steps to a new coarse angle the game emits a short rotation click so the
 * movement is audible. This trampoline is that click's entry point — rung by rotateBlasterAroundRim
 * (ROM 0x9749) whenever the coarse rim angle cell loc_2a changes from the previous frame.
 *
 * Behavior: hand the fixed sound id 0x0f to requestSoundIfEnabled, the shared sound-enable gate
 * (ROM 0xccc3), which forwards the request to the audio hardware only while sound is turned on. The
 * caller's X/Y thread through unchanged (they default from m.regs) so the gate sees the same register
 * state the 6502 had; the gate's result is returned to the caller.
 *
 * Live-out: the enable gate's return value (relayed) and, when audio is enabled, sound id 0x0f queued
 * into the sound request path. Grounding: seen.
 */
export function cueRimRotationSound(m, x = m.regs.x, y = m.regs.y) {
  // Fixed cue id 0x0f (rim-rotation click) through the enable gate; relay its result, keep X/Y.
  return requestSoundIfEnabled(m, 0x0f, x, y);
}
