// SPDX-License-Identifier: GPL-3.0-only

// loc_0174  (ROM 0x0174-0x018B)
export function loc_0174(m) {
  const { regs, mem } = m;

  m.push16(0x0177);
  m.step(0x55d4, 17); // call 0x55d4
  m.call(0x55d4);

  regs.iy = m.pop16();
  m.step(0x0179, 14); // pop iy
  regs.ix = m.pop16();
  m.step(0x017b, 14); // pop ix
  regs.hl = m.pop16();
  m.step(0x017c, 10); // pop hl
  regs.de = m.pop16();
  m.step(0x017d, 10); // pop de
  regs.bc = m.pop16();
  m.step(0x017e, 10); // pop bc
  regs.af = m.pop16();
  m.step(0x017f, 10); // pop af -- the shadow AF, selected right now
  regs.exx();
  m.step(0x0180, 4); // exx
  regs.exAf();
  m.step(0x0181, 4); // ex af,af' -- the main set is selected again
  regs.hl = m.pop16();
  m.step(0x0182, 10); // pop hl
  regs.de = m.pop16();
  m.step(0x0183, 10); // pop de
  regs.bc = m.pop16();
  m.step(0x0184, 10); // pop bc

  regs.a = mem.read8(0x1600);
  m.step(0x0187, 13); // ld a,(0x1600) -- a ROM byte holding 0x01
  mem.write8(0xc300, regs.a, 10);
  m.step(0x018a, 13); // ld (0xc300),a -- LS259 bit 0: NMI enable back on

  regs.af = m.pop16();
  m.step(0x018b, 10); // pop af

  m.ret(10); // ret -- pops the PC the NMI acceptance pushed
}
