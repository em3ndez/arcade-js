// SPDX-License-Identifier: GPL-3.0-only

// loc_507e  (ROM 0x507E–0x50B0)
export function loc_507e(m) {
  const { regs, mem } = m;

  regs.ix = 0xaa10;
  m.step(0x5082, 14); // ld ix,0xaa10
  regs.a = mem.read8(0xa800);
  m.step(0x5085, 13); // ld a,(0xa800)
  regs.a = regs.inc8(regs.a);
  m.step(0x5086, 4); // inc a
  if (regs.fNZ) {
    m.ret(11); // 0x5086 ret nz -- taken
    return;
  }
  m.step(0x5087, 5); // ret nz not taken

  regs.a = mem.read8(0xa8c0);
  m.step(0x508a, 13); // ld a,(0xa8c0)
  regs.a = regs.inc8(regs.a);
  m.step(0x508b, 4); // inc a
  if (regs.fNZ) {
    m.ret(11); // 0x508b ret nz -- taken
    return;
  }
  m.step(0x508c, 5); // ret nz not taken

  regs.a = mem.read8(0xaa28);
  m.step(0x508f, 13); // ld a,(0xaa28)
  regs.sub(mem.read8((regs.ix + 0x00) & 0xffff));
  m.step(0x5092, 19); // sub (ix+0x00)
  regs.add(0x06);
  m.step(0x5094, 7); // add a,0x06
  regs.cp(0x0d);
  m.step(0x5096, 7); // cp 0x0d
  if (regs.fNC) {
    m.ret(11); // 0x5096 ret nc -- taken
    return;
  }
  m.step(0x5097, 5); // ret nc not taken

  regs.a = mem.read8(0xaa59);
  m.step(0x509a, 13); // ld a,(0xaa59)
  regs.sub(mem.read8((regs.ix + 0x31) & 0xffff));
  m.step(0x509d, 19); // sub (ix+0x31)
  regs.add(0x18);
  m.step(0x509f, 7); // add a,0x18
  regs.cp(0x21);
  m.step(0x50a1, 7); // cp 0x21
  if (regs.fNC) {
    m.ret(11); // 0x50a1 ret nc -- taken
    return;
  }
  m.step(0x50a2, 5); // ret nc not taken

  regs.a = 0xf0;
  m.step(0x50a4, 7); // ld a,0xf0
  mem.write8(0xa800, regs.a);
  m.step(0x50a7, 13); // ld (0xa800),a
  mem.write8(0xa8c0, regs.a);
  m.step(0x50aa, 13); // ld (0xa8c0),a
  regs.xor(regs.a);
  m.step(0x50ab, 4); // xor a
  mem.write8(0xa8dc, regs.a);
  m.step(0x50ae, 13); // ld (0xa8dc),a

  m.step(0x51de, 10); // jp 0x51de -- TAIL transfer
  return m.call(0x51de);
}
