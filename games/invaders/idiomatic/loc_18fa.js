// SPDX-License-Identifier: GPL-3.0-only
import { loc_2094 } from "./names.js";

// OR the requested bits into the sound-latch shadow, store it back, and mirror it to the sound port.
export function loc_18fa(m, b = m.regs.b) {
  const v = m.mem8[loc_2094] | b;
  m.mem8[loc_2094] = v;
  m.io.portOut(0x03, v);
  return (m.regs.a = v);
}
