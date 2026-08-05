// SPDX-License-Identifier: GPL-3.0-only

// loc_50b1  (ROM 0x50B1–0x50ED)
export function loc_50b1(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;

  regs.a = mem.read8(0xad04);
  m.step(0x50b4, 13); // ld a,(0xad04)
  regs.and(regs.a);
  m.step(0x50b5, 4); // and a
  if (regs.fZ) {
    m.step(0x50ee, 12); // jr z,0x50ee
    return m.call(0x50ee); // tail transfer -- no push
  }
  m.step(0x50b7, 7); // jr z -- not taken
  regs.cp(0x04);
  m.step(0x50b9, 7); // cp 0x04
  if (regs.fZ) {
    m.step(0x50ee, 12); // jr z,0x50ee
    return m.call(0x50ee); // tail transfer -- no push
  }
  m.step(0x50bb, 7); // jr z -- not taken

  regs.ix = 0xaa10;
  m.step(0x50bf, 14); // ld ix,0xaa10
  regs.a = mem.read8(0xa800);
  m.step(0x50c2, 13); // ld a,(0xa800)
  regs.a = regs.inc8(regs.a);
  m.step(0x50c3, 4); // inc a
  if (regs.fNZ) { m.ret(11); return; } // ret nz
  m.step(0x50c4, 5); // ret nz not taken

  regs.a = mem.read8(0xa8a0);
  m.step(0x50c7, 13); // ld a,(0xa8a0)
  regs.a = regs.inc8(regs.a);
  m.step(0x50c8, 4); // inc a
  if (regs.fNZ) { m.ret(11); return; } // ret nz
  m.step(0x50c9, 5); // ret nz not taken

  regs.a = mem.read8(0xaa24);
  m.step(0x50cc, 13); // ld a,(0xaa24)
  regs.sub(mem.read8(X(0x00)));
  m.step(0x50cf, 19); // sub (ix+0x00)
  regs.add(0x06);
  m.step(0x50d1, 7); // add a,0x06
  regs.cp(0x0d);
  m.step(0x50d3, 7); // cp 0x0d
  if (regs.fNC) { m.ret(11); return; } // ret nc
  m.step(0x50d4, 5); // ret nc not taken

  regs.a = mem.read8(0xaa55);
  m.step(0x50d7, 13); // ld a,(0xaa55)
  regs.sub(mem.read8(X(0x31)));
  m.step(0x50da, 19); // sub (ix+0x31)
  regs.add(0x19);
  m.step(0x50dc, 7); // add a,0x19
  regs.cp(0x23);
  m.step(0x50de, 7); // cp 0x23
  if (regs.fNC) { m.ret(11); return; } // ret nc
  m.step(0x50df, 5); // ret nc not taken

  regs.a = 0xf0;
  m.step(0x50e1, 7); // ld a,0xf0
  mem.write8(0xa800, regs.a);
  m.step(0x50e4, 13); // ld (0xa800),a
  mem.write8(0xa8a0, regs.a);
  m.step(0x50e7, 13); // ld (0xa8a0),a
  regs.xor(regs.a);
  m.step(0x50e8, 4); // xor a
  mem.write8(0xa8a4, regs.a);
  m.step(0x50eb, 13); // ld (0xa8a4),a
  m.step(0x51de, 10); // jp 0x51de

  return m.call(0x51de); // tail jump -- no return address pushed
}
