// SPDX-License-Identifier: GPL-3.0-only
/** loc_00d8 — the frame interrupt lands here: stack the accumulator and its flags, then fall on
 * into the body that saves everything else and does the frame's work. The two bytes stacked sit
 * in work memory, so they are part of what the machine leaves behind. LIVE-OUT: memory. */

const CONTINUATION = 0x00d9;

export function loc_00d8(m) {
  const { regs } = m;
  m.push16(regs.af);
  return m.call(CONTINUATION);
}
