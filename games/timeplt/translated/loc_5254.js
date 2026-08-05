// SPDX-License-Identifier: GPL-3.0-only

// loc_5254  (ROM 0x5254-0x5269, Time Pilot)
export function loc_5254(m) {
  const { regs, mem } = m;

  regs.iy = mem.read16(0xa991);
  m.step(0x5258, 20); // ld iy,(0xa991)
  regs.de = mem.read16(0xa993);
  m.step(0x525c, 20); // ld de,(0xa993)
  regs.exAf();
  m.step(0x525d, 4); // ex af,af'
  regs.b = regs.a;
  m.step(0x525e, 4); // ld b,a -- the inner count out of A'
  regs.exAf();
  m.step(0x525f, 4); // ex af,af'
  regs.a = regs.ix & 0xff;
  m.step(0x5261, 8); // ld a,ixl
  regs.add(0x10);
  m.step(0x5263, 7); // add a,0x10
  regs.ix = (regs.ix & 0xff00) | regs.a;
  m.step(0x5265, 8); // ld ixl,a -- 8-bit: no carry into IXH
  regs.c = regs.dec8(regs.c);
  m.step(0x5266, 4); // dec c

  if (regs.fNZ) {
    m.step(0x5211, 10); // jp nz,0x5211 -- conditional TAIL jump
    return m.call(0x5211);
  }
  m.step(0x5269, 10); // jp nz NOT taken

  m.ret(); // 5269  ret
}
