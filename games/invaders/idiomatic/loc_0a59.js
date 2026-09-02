// SPDX-License-Identifier: GPL-3.0-only
import { loc_2015 } from "./names.js";

// Poll the arm-trigger cell against 0xff. Live-out is the Z flag: set via the return-assignment bridge
// so still-frozen callers branch on it; the boolean it returns is for idiomatic callers. Reads no
// register and writes no memory.
export function loc_0a59(m) {
  return (m.regs.fZ = m.mem8[loc_2015] === 0xff);
}
