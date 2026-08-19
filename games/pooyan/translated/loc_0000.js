// SPDX-License-Identifier: GPL-3.0-only

// loc_0000  (ROM 0x0000-0x0006) -- reset vector
export function loc_0000(m) {
  const { regs, mem } = m;
  regs.xor(regs.a);
  m.step(0x0001, 4); // 0000  xor a
  mem.write8(0xa180, regs.a); // ld (mainlatch bit0),0 -- NMI disabled at boot
  m.step(0x0004, 13); // 0001  ld (0xa180),a
  m.step(0x0092, 10); // 0004  jp 0x0092
  return m.call(0x0092);
}
