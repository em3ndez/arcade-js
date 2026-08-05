// SPDX-License-Identifier: GPL-3.0-only

// loc_3faf  (ROM 0x3FAF–0x3FC9)
export function loc_3faf(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x02) & 0xffff);
  m.step(0x3fb2, 19); // ld a,(ix+0x02)
  regs.add(0x08);
  m.step(0x3fb4, 7); // add a,0x08
  regs.rrca();
  m.step(0x3fb5, 4); // rrca
  regs.rrca();
  m.step(0x3fb6, 4); // rrca
  regs.rrca();
  m.step(0x3fb7, 4); // rrca
  regs.rrca();
  m.step(0x3fb8, 4); // rrca
  regs.and(0x0f);
  m.step(0x3fba, 7); // and 0x0f
  regs.hl = 0x3fca;
  m.step(0x3fbd, 10); // ld hl,0x3fca

  m.push16(0x3fbe);
  m.step(0x0008, 11); // rst 0x08 -- A = table[A], HL = &table[A]
  m.call(0x0008);

  mem.write8((regs.iy + 0x01) & 0xffff, regs.a);
  m.step(0x3fc1, 19); // ld (iy+0x01),a
  regs.de = 0x0010;
  m.step(0x3fc4, 10); // ld de,0x0010
  regs.addHl(regs.de);
  m.step(0x3fc5, 11); // add hl,de -- into the second table at 0x3fda
  regs.a = mem.read8(regs.hl);
  m.step(0x3fc6, 7); // ld a,(hl)
  mem.write8((regs.iy + 0x30) & 0xffff, regs.a);
  m.step(0x3fc9, 19); // ld (iy+0x30),a

  m.ret(); // 0x3fc9
}
