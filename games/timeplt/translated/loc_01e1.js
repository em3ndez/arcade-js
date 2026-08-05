// SPDX-License-Identifier: GPL-3.0-only

// loc_01e1  (ROM 0x01e1-0x0200, Time Pilot)
export function loc_01e1(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);
  m.step(0x01e2, 4); // 01e1  xor a
  mem.write8(0xa9e2, regs.a);
  m.step(0x01e5, 13); // 01e2  ld (0xa9e2),a

  regs.hl = mem.read16(0x0d45);
  m.step(0x01e8, 16); // 01e5  ld hl,(0x0d45)
  mem.write16(0xa9e3, regs.hl);
  m.step(0x01eb, 16); // 01e8  ld (0xa9e3),hl

  regs.hl = mem.read16(0x280c);
  m.step(0x01ee, 16); // 01eb  ld hl,(0x280c)
  mem.write16(0xa9e5, regs.hl);
  m.step(0x01f1, 16); // 01ee  ld (0xa9e5),hl

  regs.b = 0x00;
  m.step(0x01f3, 7); // 01f1  ld b,0x00 -- 0 -> 256 iterations
  regs.hl = 0x0e33;
  m.step(0x01f6, 10); // 01f3  ld hl,0x0e33
  regs.xor(regs.a);
  m.step(0x01f7, 4); // 01f6  xor a -- running total = 0

  for (;;) {
    regs.add(mem.read8(regs.hl));
    m.step(0x01f8, 7); // 01f7  add a,(hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x01f9, 6); // 01f8  inc hl
    if (regs.djnz() !== 0) {
      m.step(0x01f7, 13); // djnz taken
    } else {
      m.step(0x01fb, 8); // djnz not taken
      break;
    }
  }

  regs.sub(0xfd);
  m.step(0x01fd, 7); // 01fb  sub 0xfd -- Z iff the total is 0xfd

  if (regs.fNZ) {
    m.push16(0x0200);
    m.step(0x0069, 17); // call nz taken
    m.call(0x0069);
  } else {
    m.step(0x0200, 10); // call nz not taken
  }

  m.ret(); // 0200  ret
}
