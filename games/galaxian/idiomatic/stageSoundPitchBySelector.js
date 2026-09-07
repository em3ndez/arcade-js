// SPDX-License-Identifier: GPL-3.0-only
//
// stageSoundPitchBySelector -- ROM 0x1801. Grounding: [seen].
//
// WHAT IT IS
//   The sweep voice's pitch-selector dispatch. It reads the low two bits of the cell it is handed (the
//   sweep cell the sound-counter manager stepped its pointer to) and routes to one of two pitch sources.
//   It is tail-called from the sound-counter managers advanceSoundSweepAndStagePitch (0x17e5) and
//   tickSoundCounterAndStagePitch (0x17f9).
//
// ROLE IN THE MACHINE
//   A nonzero selector means "produce a swept pitch": hand the selector to stagePitchFromSoundCounter
//   (0x180c), which recomputes a (possibly warbled) pitch from the sound counter 0x41c4. A zero selector
//   means "hold": stage a fixed pitch of 96 via stageSoundPitch (0x1815). Both delegates end by parking
//   their byte in SOUND_PITCH (0x41c1), the shadow the per-frame driver latches out to the pitch port.
//
// LIVE-OUT
//   SOUND_PITCH (0x41c1) written by whichever delegate ran; register mirror: HL points at the sweep cell.
import { stagePitchFromSoundCounter } from "./stagePitchFromSoundCounter.js";
import { stageSoundPitch } from "./stageSoundPitch.js";

export function stageSoundPitchBySelector(m, cell = m.regs.hl) {
  // Mask the low two bits of the sweep cell; these bits select the pitch mode.
  const selector = m.mem8[cell] & 0x03;
  // Nonzero -> swept/warbled pitch recomputed from the sound counter.
  if (selector !== 0) return stagePitchFromSoundCounter(m, selector);
  // Zero -> fixed hold pitch of 96.
  return stageSoundPitch(m, 96);
}
