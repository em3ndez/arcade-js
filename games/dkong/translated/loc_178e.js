// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_178e  (ROM 0x178E–0x17B5) — rst-0x18 gate; walk 0x622A record ptr (0x7F sentinel -> 0x3A73), store 0x6227, enqueue 0x0500, reset 0x6388=0, hand 0x600A=8.
 */
export function loc_178e(m) {
  const { regs, mem } = m;
  m.push16(0x178f); m.step(0x0018, 11); if (!m.call(0x0018)) return; // rst 0x18
  regs.hl = mem.read16(0x622a);
  m.step(0x1792, 16); // ld hl,(0x622a)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1793, 6);
  regs.a = mem.read8(regs.hl);
  m.step(0x1794, 7);
  regs.cp(0x7f);
  m.step(0x1796, 7);
  if (regs.fZ) {
    m.step(0x1799, 10);
    regs.hl = 0x3a73;
    m.step(0x179c, 10);
    regs.a = mem.read8(regs.hl);
    m.step(0x179d, 7);
  } else {
    m.step(0x179d, 10);
  }
  mem.write16(0x622a, regs.hl);
  m.step(0x17a0, 16);
  mem.write8(0x6227, regs.a);
  m.step(0x17a3, 13);
  regs.de = 0x0500;
  m.step(0x17a6, 10);
  m.push16(0x17a9); m.step(0x309f, 17); m.call(0x309f); // enqueue
  regs.xor(regs.a);
  m.step(0x17aa, 4);
  mem.write8(0x6388, regs.a);
  m.step(0x17ad, 13); // 0x6388 = 0
  regs.hl = 0x6009;
  m.step(0x17b0, 10);
  mem.write8(regs.hl, 0x30);
  m.step(0x17b2, 10);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x17b3, 6);
  mem.write8(regs.hl, 0x08);
  m.step(0x17b5, 10); // 0x600A = 8
  m.ret(10);
}
