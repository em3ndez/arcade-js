// SPDX-License-Identifier: GPL-3.0-only

// loc_0726  (ROM 0x0726-0x0765) — swap the active player's work pages OUT: save 0x80FF/0x800C into
// bank {0x8500,0x86C0}, restore from bank {0x8600,0x85C0}, set (0x803F)=1. Then, unless (0x8295) is
// already nonzero, clear (0x825B) and latch (0x8295)=1.
export function loc_0726(m) {
  const { regs, mem } = m;

  regs.hl = 0x80ff;
  m.step(0x0729, 10);
  regs.de = 0x8500;
  m.step(0x072c, 10);
  regs.bc = 0x00b7;
  m.step(0x072f, 10);
  m.ldirAt(0x072f, 0x0731); // 0xB7 bytes 0x80FF -> 0x8500

  regs.hl = 0x800c;
  m.step(0x0734, 10);
  regs.de = 0x86c0;
  m.step(0x0737, 10);
  regs.bc = 0x002b;
  m.step(0x073a, 10);
  m.ldirAt(0x073a, 0x073c); // 0x2B bytes 0x800C -> 0x86C0

  regs.hl = 0x8600;
  m.step(0x073f, 10);
  regs.de = 0x80ff;
  m.step(0x0742, 10);
  regs.bc = 0x00b7;
  m.step(0x0745, 10);
  m.ldirAt(0x0745, 0x0747); // 0xB7 bytes 0x8600 -> 0x80FF

  regs.hl = 0x85c0;
  m.step(0x074a, 10);
  regs.de = 0x800c;
  m.step(0x074d, 10);
  regs.bc = 0x002b;
  m.step(0x0750, 10);
  m.ldirAt(0x0750, 0x0752); // 0x2B bytes 0x85C0 -> 0x800C

  regs.a = 0x01;
  m.step(0x0754, 7);
  mem.write8(0x803f, regs.a);
  m.step(0x0757, 13); // (0x803F) = 1

  regs.a = mem.read8(0x8295);
  m.step(0x075a, 13);
  regs.and(regs.a);
  m.step(0x075b, 4); // Z iff (0x8295)==0

  if (regs.fNZ) {
    m.ret(11); // ret nz -- already initialised
    return;
  }
  m.step(0x075c, 5);

  regs.xor(regs.a);
  m.step(0x075d, 4);
  mem.write8(0x825b, regs.a);
  m.step(0x0760, 13); // (0x825B) = 0

  regs.a = 0x01;
  m.step(0x0762, 7);
  mem.write8(0x8295, regs.a);
  m.step(0x0765, 13); // (0x8295) = 1

  m.ret();
}
