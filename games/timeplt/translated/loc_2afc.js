// SPDX-License-Identifier: GPL-3.0-only

// loc_2afc  (ROM 0x2AFC-0x2B17)
export function loc_2afc(m) {
  const { regs, mem } = m;
  const IX = (d) => (regs.ix + d) & 0xffff;
  const IY = (d) => (regs.iy + d) & 0xffff;

  regs.de = 0x0010;
  m.step(0x2aff, 10); // ld de,0x0010
  regs.a = mem.read8(IX(0x02));
  m.step(0x2b02, 19); // ld a,(ix+0x02)
  regs.add(0x08);
  m.step(0x2b04, 7); // add a,0x08
  regs.rrca();
  m.step(0x2b05, 4); // rrca
  regs.rrca();
  m.step(0x2b06, 4); // rrca
  regs.rrca();
  m.step(0x2b07, 4); // rrca
  regs.rrca();
  m.step(0x2b08, 4); // rrca
  regs.and(0x0f);
  m.step(0x2b0a, 7); // and 0x0f -- 16-way direction
  regs.hl = 0x2b18; // the first table, right after this routine
  m.step(0x2b0d, 10); // ld hl,0x2b18

  m.push16(0x2b0e);
  m.step(0x0018, 11); // rst 0x18 -- HL += A
  m.call(0x0018);

  regs.a = mem.read8(regs.hl);
  m.step(0x2b0f, 7); // ld a,(hl)
  mem.write8(IY(0x01), regs.a);
  m.step(0x2b12, 19); // ld (iy+0x01),a
  regs.addHl(regs.de);
  m.step(0x2b13, 11); // add hl,de -- the second table
  regs.a = mem.read8(regs.hl);
  m.step(0x2b14, 7); // ld a,(hl)
  mem.write8(IY(0x30), regs.a);
  m.step(0x2b17, 19); // ld (iy+0x30),a

  m.ret(); // 2b17  ret
}
