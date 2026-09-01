// SPDX-License-Identifier: GPL-3.0-only
import { loc_2094 } from "./names.js";

// AND the sound shadow with B (mask bits off), write it back and mirror to the sound port. Value-out: A.
export function loc_19dc(m, b = m.regs.b) {
  const v = m.mem8[loc_2094] & b;
  m.mem8[loc_2094] = v;
  m.io.portOut(0x03, v);
  return (m.regs.a = v);
}
