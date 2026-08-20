// SPDX-License-Identifier: GPL-3.0-only

// loc_423a  (ROM 0x423a-0x4243) -- interior-entry mirror of loc_4221: point DE at the 0x4212
// animation script, clear the 0x8d4b mode flag, then tail-jump to loc_381e to arm the script.
export function loc_423a(m) {
  const { regs, mem } = m;

  regs.de = 0x4212;            m.step(0x423d, 10);
  regs.xor(regs.a);            m.step(0x423e, 4);
  mem.write8(0x8d4b, regs.a);  m.step(0x4241, 13);
  m.step(0x381e, 10);          // jp 0x381e (tail -- arm animation, frame reused, no push16)
  return m.call(0x381e);
}
