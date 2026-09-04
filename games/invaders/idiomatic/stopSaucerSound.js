// SPDX-License-Identifier: GPL-3.0-only
import { clearSoundPort3Bit } from "./clearSoundPort3Bit.js";

// Clear the low sound-latch bit (mask 0xfe) through the shared port-3 helper. Value-out: A.
export function stopSaucerSound(m) {
  return clearSoundPort3Bit(m, 0xfe);
}
