// SPDX-License-Identifier: GPL-3.0-only
import { SOUND_PORT3_SHADOW } from "./names.js";

// OR the requested bits into the sound-latch shadow, store it back, and mirror it to the sound port.
export function startSound(m, b = m.regs.b) {
  const v = m.mem8[SOUND_PORT3_SHADOW] | b;
  m.mem8[SOUND_PORT3_SHADOW] = v;
  m.io.portOut(0x03, v);
  return (m.regs.a = v);
}
