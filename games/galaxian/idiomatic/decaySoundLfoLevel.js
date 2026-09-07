// SPDX-License-Identifier: GPL-3.0-only
/**
 * decaySoundLfoLevel (ROM 0x18a6) -- the once-per-256-frames LFO level decay step.
 *
 * WHAT IT IS
 *   The sound hardware's low-frequency oscillator (LFO) has a level shadow, SOUND_LFO_LEVEL (0x421f).
 *   This routine ramps that level down slowly: it fires only on the single frame when FRAME_COUNTER
 *   (0x425f) reads 0xff, and only if the level is still nonzero. On that tick it drops the level by one
 *   and pushes the new value out through broadcastSoundLfoLevel (0x18b2), which fans it (rotated right
 *   one bit per write) across the four SOUND_LFO_FREQ hardware latches. Every other frame it is idle.
 *
 * ROLE IN THE MACHINE
 *   The decay arm of driveSoundLfoLevel (0x1898), the per-frame LFO driver reached from the VBLANK-NMI
 *   (loc_0066): with no reset request pending it runs this decay; a pending request instead slams the
 *   level to full. Gating on FRAME_COUNTER==0xff makes the audible sweep decay about once per 256
 *   frames rather than every frame.
 *
 * ROM 0x18a6.  Grounding: [seen] (names.js cert for 0x18a6).
 *
 * LIVE-OUT: SOUND_LFO_LEVEL (0x421f) and the four SOUND_LFO_FREQ latches, only on the 0xff tick.
 */
import { broadcastSoundLfoLevel } from "./broadcastSoundLfoLevel.js";
import { FRAME_COUNTER, SOUND_LFO_LEVEL } from "./names.js";

export function decaySoundLfoLevel(m) {
  const { mem8 } = m;

  // Armed on exactly one frame in 256 -- the FRAME_COUNTER == 0xff tick; every other frame is a no-op.
  if (mem8[FRAME_COUNTER] !== 0xff) return;

  // Already at the floor: nothing to decay, leave the latches as they are.
  const level = mem8[SOUND_LFO_LEVEL];
  if (level === 0) return; // already floored

  // Drop one step and re-broadcast; the helper stores the shadow and fans it to the frequency latches.
  broadcastSoundLfoLevel(m, level - 1);
}
