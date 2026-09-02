// SPDX-License-Identifier: GPL-3.0-only
import { loc_2084, loc_2085 } from "./names.js";
import { stopSaucerSound } from "./stopSaucerSound.js";
import { startSound } from "./startSound.js";

// Drive the saucer sound from a two-byte gate: silence it when the first flag is clear; otherwise,
// only when the second flag is also clear, arm the sound with request bit 0.
export function loc_1804(m) {
  if (m.mem8[loc_2084] === 0) return stopSaucerSound(m);
  if (m.mem8[loc_2085] !== 0) return;
  return startSound(m, 0x01);
}
