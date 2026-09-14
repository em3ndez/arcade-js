// SPDX-License-Identifier: GPL-3.0-only
import { requestSoundIfEnabled } from "./requestSoundIfEnabled.js";

// Request a fixed sound id through the sound gate.
export function loc_ccb9(m) {
  requestSoundIfEnabled(m, 0x4f);
}
