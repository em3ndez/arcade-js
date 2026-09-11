// SPDX-License-Identifier: GPL-3.0-only
// loc_970b  (ROM 0x970b-0x9728) -- per-frame dispatcher: calls nine subroutines in order then
// tail-jumps to loc_a504.
export function loc_970b(m) {
  const { regs, mem } = m;
  m.push16(0x970d); m.step(0x970e, 6); m.call(0x9749);
  m.push16(0x9710); m.step(0x9711, 6); m.call(0xa23f);
  m.push16(0x9713); m.step(0x9714, 6); m.call(0xa83a);
  m.push16(0x9716); m.step(0x9717, 6); m.call(0x98a2);
  m.push16(0x9719); m.step(0x971a, 6); m.call(0x9b1e);
  m.push16(0x971c); m.step(0x971d, 6); m.call(0xa18f);
  m.push16(0x971f); m.step(0x9720, 6); m.call(0xa2a6);
  m.push16(0x9722); m.step(0x9723, 6); m.call(0xa454);
  m.push16(0x9725); m.step(0x9726, 6); m.call(0xa416);
  m.step(0xa504, 3); return m.call(0xa504);
}
