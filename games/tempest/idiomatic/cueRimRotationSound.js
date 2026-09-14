// SPDX-License-Identifier: GPL-3.0-only
import { requestSoundIfEnabled } from "./requestSoundIfEnabled.js";

// Load a fixed sound id and pass it through the sound gate, keeping caller X/Y.
export function cueRimRotationSound(m, x = m.regs.x, y = m.regs.y) {
  return requestSoundIfEnabled(m, 0x0f, x, y);
}
