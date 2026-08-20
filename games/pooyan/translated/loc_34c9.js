// SPDX-License-Identifier: GPL-3.0-only

// loc_34c9  (ROM 0x34c9-0x34f1) -- render the two-digit value at 0x8901 into VRAM at 0x8743/0x8763.
// B = value. If value >= 10 the tens byte is BCD-converted (0x8907... no: the add-1 loop converts B),
// gated by 0x8f50 (ret nz if already handled). The low nibble is written to 0x8743; HL += 0x20 to
// the next cell; the high nibble (B >> 4) is written to 0x8763 only when nonzero (ret z suppresses a
// leading-zero tile). Leaf -- no calls.
export function loc_34c9(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8901);  m.step(0x34cc, 13);
  regs.b = regs.a;             m.step(0x34cd, 4);
  regs.hl = 0x8743;            m.step(0x34d0, 10);
  regs.de = 0x0020;            m.step(0x34d3, 10);
  regs.cp(0x0a);               m.step(0x34d5, 7);
  if (regs.fC) {
    m.step(0x34e3, 12);        // jr c (value < 10) -> single digit, B already the value
  } else {
    m.step(0x34d7, 7);
    regs.a = mem.read8(0x8f50); m.step(0x34da, 13);
    regs.and(regs.a);          m.step(0x34db, 4);
    if (regs.fNZ) { return m.ret(11); } // ret nz
    m.step(0x34dc, 5);
    regs.xor(regs.a);          m.step(0x34dd, 4);
    for (;;) { // loc_34dd: BCD-convert B by adding 1 B times
      regs.add(0x01);          m.step(0x34df, 7);
      regs.daa();              m.step(0x34e0, 4);
      if (regs.djnz()) { m.step(0x34dd, 13); } else { m.step(0x34e2, 8); break; }
    }
    regs.b = regs.a;           m.step(0x34e3, 4);
  }

  // loc_34e3
  regs.and(0x0f);              m.step(0x34e5, 7); // low nibble
  mem.write8(regs.hl, regs.a);  m.step(0x34e6, 7);
  regs.addHl(regs.de);         m.step(0x34e7, 11);
  regs.a = regs.b;             m.step(0x34e8, 4);
  regs.rrca();                 m.step(0x34e9, 4);
  regs.rrca();                 m.step(0x34ea, 4);
  regs.rrca();                 m.step(0x34eb, 4);
  regs.rrca();                 m.step(0x34ec, 4);
  regs.and(0x0f);              m.step(0x34ee, 7); // high nibble
  regs.and(regs.a);            m.step(0x34ef, 4);
  if (regs.fZ) { return m.ret(11); } // ret z -- suppress leading zero
  m.step(0x34f0, 5);
  mem.write8(regs.hl, regs.a);  m.step(0x34f1, 7);
  return m.ret(10);            // 34f1  ret
}
