// SPDX-License-Identifier: GPL-3.0-only
import { loadSoundVoiceSlots } from "./loadSoundVoiceSlots.js";

// Trampoline: register the fixed sound id 0xaf.
export function requestActiveSoundCue(m, x = m.regs.x, y = m.regs.y) {
  loadSoundVoiceSlots(m, 0xaf, x, y);
}
