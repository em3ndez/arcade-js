// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2f43  (ROM 0x2F43–0x2F79) — advance the 0x6394/0x6395 counter chain; on wrap, flip (0x6217) + neg X into (ix+0e).
 */
export function loc_2f43(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  regs.a = regs.c;
  m.step(0x2f44, 4); // ld a,c
  mem.write8(0x694d, regs.a);
  m.step(0x2f47, 13); // ld (0x694d),a
  regs.c = 0x07;
  m.step(0x2f49, 7); // ld c,0x07
  regs.hl = 0x6394;
  m.step(0x2f4c, 10); // ld hl,0x6394
  regs.incMem8(mem, regs.hl);
  m.step(0x2f4d, 11); // inc (hl)
  if (regs.fNZ) { m.step(0x2fb7, 10); return m.call(0x2fb7); } // jp nz,0x2fb7
  m.step(0x2f50, 10);
  regs.hl = 0x6395;
  m.step(0x2f53, 10); // ld hl,0x6395
  regs.incMem8(mem, regs.hl);
  m.step(0x2f54, 11); // inc (hl)
  regs.a = mem.read8(regs.hl);
  m.step(0x2f55, 7); // ld a,(hl)
  regs.cp(0x02);
  m.step(0x2f57, 7); // cp 0x02
  if (regs.fNZ) { m.step(0x2fbe, 10); return m.call(0x2fbe); } // jp nz,0x2fbe
  m.step(0x2f5a, 10);
  regs.xor(regs.a);
  m.step(0x2f5b, 4); // xor a
  mem.write8(0x6395, regs.a);
  m.step(0x2f5e, 13); // ld (0x6395),a
  mem.write8(0x6217, regs.a);
  m.step(0x2f61, 13); // ld (0x6217),a
  mem.write8(R(0x01), regs.a);
  m.step(0x2f64, 19); // ld (ix+0x01),a
  regs.a = mem.read8(0x6203);
  m.step(0x2f67, 13); // ld a,(0x6203)
  regs.neg();
  m.step(0x2f69, 8); // neg
  mem.write8(R(0x0e), regs.a);
  m.step(0x2f6c, 19); // ld (ix+0x0e),a
  regs.a = mem.read8(0x6207);
  m.step(0x2f6f, 13); // ld a,(0x6207)
  mem.write8(0x694d, regs.a);
  m.step(0x2f72, 13); // ld (0x694d),a
  mem.write8(R(0x00), 0x00);
  m.step(0x2f76, 19); // ld (ix+0x00),0x00
  regs.a = mem.read8(0x6389);
  m.step(0x2f79, 13); // ld a,(0x6389)
  mem.write8(0x6089, regs.a);
  m.step(0x2f7c, 13); // ld (0x6089),a -- falls into loc_2f7c
  return m.call(0x2f7c);
}
