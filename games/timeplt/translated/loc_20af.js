// SPDX-License-Identifier: GPL-3.0-only

// loc_20af  (ROM 0x20AF–0x20CD)
export function loc_20af(m) {
  const { regs, mem } = m;

  regs.ix = 0xa800;
  m.step(0x20b3, 14); // ld ix,0xa800 -- not read by this routine
  regs.de = 0x0020;
  m.step(0x20b6, 10); // ld de,0x0020
  regs.a = mem.read8(0xa802);
  m.step(0x20b9, 13); // ld a,(0xa802)
  regs.add(0x04); // round-to-nearest before the >>3
  m.step(0x20bb, 7); // add a,0x04
  regs.rrca();
  m.step(0x20bc, 4); // rrca
  regs.rrca();
  m.step(0x20bd, 4); // rrca
  regs.rrca();
  m.step(0x20be, 4); // rrca
  regs.and(0x1f); // 32 steps
  m.step(0x20c0, 7); // and 0x1f
  regs.hl = 0x20ce; // the bytes right after this routine
  m.step(0x20c3, 10); // ld hl,0x20ce

  m.push16(0x20c4);
  m.step(0x0018, 11); // rst 0x18 -- HL += A
  m.call(0x0018);

  regs.a = mem.read8(regs.hl);
  m.step(0x20c5, 7); // ld a,(hl)
  mem.write8(0xaa11, regs.a);
  m.step(0x20c8, 13); // ld (0xaa11),a
  regs.addHl(regs.de); // second table, 0x20 further on
  m.step(0x20c9, 11); // add hl,de
  regs.a = mem.read8(regs.hl);
  m.step(0x20ca, 7); // ld a,(hl)
  mem.write8(0xaa40, regs.a);
  m.step(0x20cd, 13); // ld (0xaa40),a

  m.ret(); // 20cd
}
