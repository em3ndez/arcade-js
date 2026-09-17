// SPDX-License-Identifier: GPL-3.0-only
/** saveAccumulatorForFrameInterrupt — the frame interrupt lands here: stack the accumulator and its flags, then fall on
 * into the body that saves everything else and does the frame's work. The two bytes stacked sit
 * in work memory, so they are part of what the machine leaves behind. LIVE-OUT: memory. */

import { serviceVerticalBlankInterrupt_ADDR } from "./names.js";

export function saveAccumulatorForFrameInterrupt(m, af = m.regs.af) {
  m.push16(af);
  return m.call(serviceVerticalBlankInterrupt_ADDR);
}
