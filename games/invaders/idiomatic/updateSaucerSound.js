// SPDX-License-Identifier: GPL-3.0-only
import { SAUCER_ACTIVE, SAUCER_EXITING } from "./names.js";
import { stopSaucerSound } from "./stopSaucerSound.js";
import { startSound } from "./startSound.js";

// Drive the saucer sound from a two-byte gate: silence it when the first flag is clear; otherwise,
// only when the second flag is also clear, arm the sound with request bit 0.
export function updateSaucerSound(m) {
  if (m.mem8[SAUCER_ACTIVE] === 0) return stopSaucerSound(m);
  if (m.mem8[SAUCER_EXITING] !== 0) return;
  return startSound(m, 0x01);
}
