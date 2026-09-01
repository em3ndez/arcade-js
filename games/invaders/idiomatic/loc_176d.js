// SPDX-License-Identifier: GPL-3.0-only
import { loc_2098 } from "./names.js";

// Silence the per-shot sound channels, emitting only the two latched high bits to the sound port.
export function loc_176d(m) {
  m.io.portOut(0x05, m.mem8[loc_2098] & 0x30);
}
