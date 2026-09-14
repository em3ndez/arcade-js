// SPDX-License-Identifier: GPL-3.0-only
import { requestSoundIfEnabled } from "./requestSoundIfEnabled.js";

// Trampoline: register the fixed sound id 0x2f through the enable gate, forwarding the slot index x.
export function loc_ccea(m, x = m.regs.x) {
  requestSoundIfEnabled(m, 0x2f, x);
}
