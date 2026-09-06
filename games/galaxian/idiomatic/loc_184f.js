// SPDX-License-Identifier: GPL-3.0-only
// Sound-envelope word tick: when the low byte's bit0 is set, reset the word to its high-bit sentinel
// and stop; otherwise hand the high byte to the countdown pulse processor.
import { pulseSoundToneFromCountdown } from "./pulseSoundToneFromCountdown.js";
import { loc_41c7, loc_41c8 } from "./names.js";

export function loc_184f(m) {
  const { mem8 } = m;

  if ((mem8[loc_41c7] & 0x01) === 0) {
    // bit0 clear: process the high byte
    return pulseSoundToneFromCountdown(m, mem8[loc_41c8]);
  }

  // bit0 set: reset the word (low 0, high 128)
  mem8[loc_41c7] = 0;
  mem8[loc_41c8] = 128;
}
