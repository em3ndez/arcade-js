// SPDX-License-Identifier: GPL-3.0-only
import { STATUS_FLAGS } from "./names.js";
import { loadSoundVoiceSlots } from "./loadSoundVoiceSlots.js";

// Sound gate: register the sound in A only when the enable flag's high bit is set.
export function requestSoundIfEnabled(m, a = m.regs.a, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  if ((mem8[STATUS_FLAGS] & 0x80) === 0) return;
  loadSoundVoiceSlots(m, a, x, y);
}
