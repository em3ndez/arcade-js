// SPDX-License-Identifier: GPL-3.0-only
// Stage the pitch value: park the byte in A into SOUND_PITCH, the shadow cell the per-frame driver
// later latches out to the pitch port. Writes that cell and nothing else.
// SOUND_PITCH (0x41c1) is the software shadow; the driver copies it to the hardware pitch latch (0x7800),
// which sets the discrete-tone frequency (192000/(256-pitch)) -- staging here defers the actual port write.
import { SOUND_PITCH } from "./names.js";

// A is the value to stage; defaults to the live A register so a still-Z80 caller reaches the same path.
export function stageSoundPitch(m, value = m.regs.a) {
  const { mem8 } = m;

  // Park the pitch value; the driver latches it to the pitch port later this frame.
  mem8[SOUND_PITCH] = value;
}
