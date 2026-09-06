// SPDX-License-Identifier: GPL-3.0-only
// High-byte handler for a decrementing word: idle when the high byte is zero. Otherwise store it
// decremented as the word's high byte, then stage a sound-shape value into the pitch/flag pair --
// nonzero (129) when bit2 of the decremented byte is set, otherwise zero.
import { stagePitchAndRaiseSoundFlag } from "./stagePitchAndRaiseSoundFlag.js";
import { loc_41c8 } from "./names.js";

export function pulseSoundToneFromCountdown(m, high = m.regs.h) {
  const { mem8 } = m;
  if (high === 0) return;

  const stored = high - 1;
  mem8[loc_41c8] = stored;

  return stagePitchAndRaiseSoundFlag(m, (stored & 0x04) ? 129 : 0);
}
