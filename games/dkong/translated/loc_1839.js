// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1839  (ROM 0x1839–0x186E) — 0x1644 idx 2: rate-limited animation stepper (every-8th; wrap-path full setup).
 */
export function loc_1839(m) {
  const { regs, mem } = m;
  regs.hl = 0x6390;
  m.step(0x183c, 10); // ld hl,0x6390
  regs.incMem8(mem, regs.hl); // inc (hl) -- Z on wrap
  m.step(0x183d, 11);
  if (regs.fZ) {
    m.step(0x1859, 10); // jp z,0x1859 (wrap path)
    regs.hl = 0x385c;
    m.step(0x185c, 10); // ld hl,0x385c
    m.push16(0x185f); m.step(0x004e, 17); m.call(0x004e);
    regs.hl = 0x6908;
    m.step(0x1862, 10); // ld hl,0x6908
    regs.c = 0x44;
    m.step(0x1864, 7); // ld c,0x44
    m.push16(0x1865); m.step(0x0038, 11); m.call(0x0038); // rst 0x38
    regs.a = 0x20;
    m.step(0x1867, 7); // ld a,0x20
    mem.write8(0x6009, regs.a); // arm countdown
    m.step(0x186a, 13);
    regs.hl = 0x6388;
    m.step(0x186d, 10); // ld hl,0x6388
    regs.incMem8(mem, regs.hl); // inc (hl) -- advance selector
    m.step(0x186e, 11);
    m.ret();
    return;
  }
  m.step(0x1840, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x1841, 7); // ld a,(hl)
  regs.and(0x07);
  m.step(0x1843, 7); // and 0x07
  if (regs.fNZ) { m.ret(11); return; } // ret nz -- not the 8th tick
  m.step(0x1844, 5);
  regs.de = 0x39cf;
  m.step(0x1847, 10); // ld de,0x39cf
  regs.bit(3, mem.read8(regs.hl)); // bit 3,(hl)
  m.step(0x1849, 12);
  if (regs.fZ) {
    m.step(0x184b, 7); // jr nz not taken (bit clear)
    regs.de = 0x39f7;
    m.step(0x184e, 10); // ld de,0x39f7
  } else {
    m.step(0x184e, 12); // jr nz -- keep 0x39CF
  }
  regs.exDeHl();
  m.step(0x184f, 4); // ex de,hl
  m.push16(0x1852); m.step(0x004e, 17); m.call(0x004e);
  regs.hl = 0x6908;
  m.step(0x1855, 10); // ld hl,0x6908
  regs.c = 0x44;
  m.step(0x1857, 7); // ld c,0x44
  m.push16(0x1858); m.step(0x0038, 11); m.call(0x0038); // rst 0x38
  m.ret();
}
