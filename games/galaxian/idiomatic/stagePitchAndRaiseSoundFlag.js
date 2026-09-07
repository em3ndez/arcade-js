// SPDX-License-Identifier: GPL-3.0-only
//
// stagePitchAndRaiseSoundFlag -- ROM 0x186c. Grounding: [seen].
//
// WHAT IT IS
//   A tiny shared writer for the sound driver's output-shadow pair: it parks a pitch byte into SOUND_PITCH
//   and stamps the composite flag byte to 1, marking "the pulse voice spoke this frame". It is the tail of
//   the pulse-tone envelope handler (pulseSoundToneFromCountdown, 0x185e), which passes the two-level
//   pulse value (129 or 0) in A.
//
// ROLE IN THE MACHINE
//   Nothing plays directly; each voice writes intent into RAM shadow cells and the per-frame driver
//   (driveSoundFrame, 0x16f5) latches the composed bytes to the discrete-sound hardware. SOUND_PITCH
//   (0x41c1) is the staged pitch shadow copied out to the pitch latch 0x7800; loc_41c0 (0x41c0) is the
//   composite "which voice spoke" flag latched to sound register 0x6806 (and its rotate-right to 0x6807).
//   Stamping the composite to 1 is the pulse envelope's signature (the sequence channels stamp 2, the ramp
//   clears it to 0); whichever voice wrote last in the fixed updater order wins the frame.
//
// LIVE-OUT
//   mem8[SOUND_PITCH] = (A - 1) mod 256, mem8[loc_41c0] = 1.
import { loc_41c0, SOUND_PITCH } from "./names.js";

export function stagePitchAndRaiseSoundFlag(m, a = m.regs.a) {
  const { mem8 } = m;

  // Store A-1 as the value byte; the subtract is modulo 256 (A = 0 stores 255).
  const value = (a - 1) & 0xff;
  mem8[SOUND_PITCH] = value;

  // Raise the flag byte: the shadow pair is filled for this frame.
  mem8[loc_41c0] = 1;
}
