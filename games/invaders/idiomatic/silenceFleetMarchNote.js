// SPDX-License-Identifier: GPL-3.0-only
import { SOUND_PORT5_SHADOW } from "./names.js";

// Silence the per-shot sound channels, emitting only the two latched high bits to the sound port.
export function silenceFleetMarchNote(m) {
  m.io.portOut(0x05, m.mem8[SOUND_PORT5_SHADOW] & 0x30);
}
