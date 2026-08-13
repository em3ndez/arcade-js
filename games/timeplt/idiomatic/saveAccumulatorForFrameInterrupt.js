// SPDX-License-Identifier: GPL-3.0-only
/** saveAccumulatorForFrameInterrupt — the frame interrupt lands here: stack the accumulator and its flags, then fall on
 * into the body that saves everything else and does the frame's work. The two bytes stacked sit
 * in work memory, so they are part of what the machine leaves behind. LIVE-OUT: memory. */

import { loc_00d9 } from "./names.js";

export function saveAccumulatorForFrameInterrupt(m) {
  const { regs } = m;
  m.push16(regs.af);
  return m.call(loc_00d9);
}
