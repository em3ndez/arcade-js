// SPDX-License-Identifier: GPL-3.0-only
import { SOUND_PORT3_SHADOW } from "./names.js";

// AND the sound shadow with B (mask bits off), write it back and mirror to the sound port. Value-out: A.
export function clearSoundPort3Bit(m, b = m.regs.b) {
  const v = m.mem8[SOUND_PORT3_SHADOW] & b;
  m.mem8[SOUND_PORT3_SHADOW] = v;
  m.io.portOut(0x03, v);
  return (m.regs.a = v);
}
