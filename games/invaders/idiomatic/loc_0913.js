// SPDX-License-Identifier: GPL-3.0-only
import { loc_2009, SAUCER_TIMER, loc_2083, TIMER_RELOAD } from "./names.js";

// Count the rolling 16-bit timer down while its gate is low; on wrap reload it and raise the wrap flag.
export function loc_0913(m) {
  if (m.mem8[loc_2009] >= 0x78) return;
  let n = m.mem16[SAUCER_TIMER];
  if (n === 0) {
    n = TIMER_RELOAD;
    m.mem8[loc_2083] = 1;
  }
  m.mem16[SAUCER_TIMER] = n - 1;
}
