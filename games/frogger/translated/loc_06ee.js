// SPDX-License-Identifier: GPL-3.0-only

// loc_06ee  (ROM 0x06EE-0x0725) — swap the live 0x800C/0x80FF work pages IN for the active player:
// save them to bank {0x85C0,0x8600}, restore this player's pages from bank {0x86C0,0x8500}, set
// (0x803F)=1. When (0x83FD)!=1 tail to loc_0726 (the swap-OUT).
export function loc_06ee(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83fd);
  m.step(0x06f1, 13); // A = current player number

  regs.a = regs.dec8(regs.a);
  m.step(0x06f2, 4); // Z iff player 1

  if (regs.fNZ) {
    m.step(0x0726, 12); // jr nz,0x0726 -- player 2: swap-OUT instead
    return m.call(0x0726);
  }
  m.step(0x06f4, 7);

  regs.hl = 0x800c;
  m.step(0x06f7, 10);
  regs.de = 0x85c0;
  m.step(0x06fa, 10);
  regs.bc = 0x002b;
  m.step(0x06fd, 10);
  m.ldirAt(0x06fd, 0x06ff); // 0x2B bytes 0x800C -> 0x85C0

  regs.hl = 0x80ff;
  m.step(0x0702, 10);
  regs.de = 0x8600;
  m.step(0x0705, 10);
  regs.bc = 0x00b7;
  m.step(0x0708, 10);
  m.ldirAt(0x0708, 0x070a); // 0xB7 bytes 0x80FF -> 0x8600

  regs.hl = 0x86c0;
  m.step(0x070d, 10);
  regs.de = 0x800c;
  m.step(0x0710, 10);
  regs.bc = 0x002b;
  m.step(0x0713, 10);
  m.ldirAt(0x0713, 0x0715); // 0x2B bytes 0x86C0 -> 0x800C

  regs.a = 0x01;
  m.step(0x0717, 7);
  mem.write8(0x803f, regs.a);
  m.step(0x071a, 13); // (0x803F) = 1

  regs.hl = 0x8500;
  m.step(0x071d, 10);
  regs.de = 0x80ff;
  m.step(0x0720, 10);
  regs.bc = 0x00b7;
  m.step(0x0723, 10);
  m.ldirAt(0x0723, 0x0725); // 0xB7 bytes 0x8500 -> 0x80FF

  m.ret();
}
