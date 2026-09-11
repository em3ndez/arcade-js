// SPDX-License-Identifier: GPL-3.0-only
import { loc_29, loc_2a, loc_2b, loc_a788 } from "./names.js";

// Step a signed 16-bit velocity (whole:low) one fixed increment toward zero:
// add when the whole is negative, subtract otherwise. On crossing zero, snap to
// zero and bump a saturation counter. Returns [low, whole].
export function loc_a75d(m, a = m.regs.a, y = m.regs.y) {
  const { mem8 } = m;
  mem8[loc_2b] = y;
  const step = mem8[loc_a788];

  let low, whole, crossed;
  if (y & 0x80) {
    low = a + step;
    whole = y + (low > 0xff ? 1 : 0);
    crossed = whole > 0xff;
  } else {
    low = a - step;
    whole = y - (low < 0 ? 1 : 0);
    crossed = whole < 0;
  }
  mem8[loc_2a] = low;

  if (crossed) {
    mem8[loc_29] = mem8[loc_29] + 1;
    mem8[loc_2a] = 0;
    low = 0;
    whole = 0;
  }
  return [(m.regs.a = low & 0xff), (m.regs.y = whole & 0xff)];
}
