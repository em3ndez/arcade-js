// SPDX-License-Identifier: GPL-3.0-only

// loc_425c  (ROM 0x425c-0x4265) -- interior-entry mirror of loc_4221: point DE at the 0x4203
// animation script, set the 0x8d4b mode flag to 0xff, then jr into loc_423a's tail jp 0x381e.
export function loc_425c(m) {
  const { regs, mem } = m;

  regs.de = 0x4203;            m.step(0x425f, 10);
  regs.a = 0xff;               m.step(0x4261, 7);
  mem.write8(0x8d4b, regs.a);  m.step(0x4264, 13);
  m.step(0x4241, 12);          // jr 0x4241 -> the jp 0x381e
  m.step(0x381e, 10);          // jp 0x381e (tail -- arm animation, frame reused, no push16)
  return m.call(0x381e);
}
