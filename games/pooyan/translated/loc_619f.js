// SPDX-License-Identifier: GPL-3.0-only

// loc_619f  (ROM 0x619f-0x61b3) -- initialize a fresh 0x18-byte actor record at (HL):
// (+0)=0x00, (+1)=0x01, (+2)=0x08, (+0x12)=0xff, then DE stored at (+0x16)/(+0x17). Leaf, no calls.
export function loc_619f(m) {
  const { regs, mem } = m;

  mem.write8(regs.hl, 0x00);         m.step(0x61a1, 10);
  regs.hl = (regs.hl + 1) & 0xffff;  m.step(0x61a2, 6);
  mem.write8(regs.hl, 0x01);         m.step(0x61a4, 10);
  regs.hl = (regs.hl + 1) & 0xffff;  m.step(0x61a5, 6);
  mem.write8(regs.hl, 0x08);         m.step(0x61a7, 10);
  regs.bc = 0x0010;                  m.step(0x61aa, 10);
  regs.addHl(regs.bc);               m.step(0x61ab, 11); // HL += 0x10 -> record offset 0x12
  mem.write8(regs.hl, 0xff);         m.step(0x61ad, 10);
  regs.c = 0x04;                     m.step(0x61af, 7);  // BC = 0x0004
  regs.addHl(regs.bc);               m.step(0x61b0, 11); // HL += 4 -> record offset 0x16
  mem.write8(regs.hl, regs.e);       m.step(0x61b1, 7);
  regs.hl = (regs.hl + 1) & 0xffff;  m.step(0x61b2, 6);
  mem.write8(regs.hl, regs.d);       m.step(0x61b3, 7);

  m.ret(10); // 61b3  ret
}
