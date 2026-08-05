// SPDX-License-Identifier: GPL-3.0-only

// loc_1ae4  (ROM 0x1AE4–0x1AFB)
export function loc_1ae4(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;

  regs.ix = 0xa810;
  m.step(0x1ae8, 14); // ld ix,0xa810
  regs.a = 0x01;
  m.step(0x1aea, 7); // ld a,0x01
  regs.b = 0x17;
  m.step(0x1aec, 7); // ld b,0x17
  regs.de = 0x0010;
  m.step(0x1aef, 10); // ld de,0x0010

  do {
    mem.write8(X(0x00), 0x00);
    m.step(0x1af3, 19); // ld (ix+0x00),0x00
    mem.write8(X(0x0f), regs.a);
    m.step(0x1af6, 19); // ld (ix+0x0f),a
    regs.a = regs.inc8(regs.a);
    m.step(0x1af7, 4); // inc a
    regs.addIx(regs.de);
    m.step(0x1af9, 15); // add ix,de
    regs.djnz();
    m.step(regs.b !== 0 ? 0x1aef : 0x1afb, regs.b !== 0 ? 13 : 8); // djnz 0x1aef
  } while (regs.b !== 0);

  m.ret(10); // ret (0x1AFB)
}
