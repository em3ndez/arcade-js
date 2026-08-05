// SPDX-License-Identifier: GPL-3.0-only

// loc_50ee  (ROM 0x50EE-0x5120, Time Pilot)
export function loc_50ee(m) {
  const { regs, mem } = m;

  regs.ix = 0xaa10;
  m.step(0x50f2, 14); // ld ix,0xaa10

  regs.a = mem.read8(0xa800);
  m.step(0x50f5, 13); // ld a,(0xa800)

  regs.a = regs.inc8(regs.a);
  m.step(0x50f6, 4); // inc a -- Z only if the byte was 0xFF

  if (regs.fNZ) {
    m.ret(11); // ret nz taken -- (0xa800) is not 0xFF
    return;
  }
  m.step(0x50f7, 5); // ret nz not taken

  regs.a = mem.read8(0xa8a0);
  m.step(0x50fa, 13); // ld a,(0xa8a0)

  regs.a = regs.inc8(regs.a);
  m.step(0x50fb, 4); // inc a

  if (regs.fNZ) {
    m.ret(11); // ret nz taken -- (0xa8a0) is not 0xFF
    return;
  }
  m.step(0x50fc, 5); // ret nz not taken

  regs.a = mem.read8(0xaa24);
  m.step(0x50ff, 13); // ld a,(0xaa24)

  regs.sub(mem.read8((regs.ix + 0x00) & 0xffff));
  m.step(0x5102, 19); // sub (ix+0x00)

  regs.add(0x08);
  m.step(0x5104, 7); // add a,0x08 -- bias

  regs.cp(0x11);
  m.step(0x5106, 7); // cp 0x11 -- window [-8,+8]

  if (regs.fNC) {
    m.ret(11); // ret nc taken -- outside the axis-1 window
    return;
  }
  m.step(0x5107, 5); // ret nc not taken

  regs.a = mem.read8(0xaa55);
  m.step(0x510a, 13); // ld a,(0xaa55)

  regs.sub(mem.read8((regs.ix + 0x31) & 0xffff));
  m.step(0x510d, 19); // sub (ix+0x31)

  regs.add(0x19);
  m.step(0x510f, 7); // add a,0x19 -- bias

  regs.cp(0x23);
  m.step(0x5111, 7); // cp 0x23 -- window [-0x19,+0x09]

  if (regs.fNC) {
    m.ret(11); // ret nc taken -- outside the axis-2 window
    return;
  }
  m.step(0x5112, 5); // ret nc not taken

  regs.a = 0xf0;
  m.step(0x5114, 7); // ld a,0xf0

  mem.write8(0xa800, regs.a);
  m.step(0x5117, 13); // ld (0xa800),a

  mem.write8(0xa8a0, regs.a);
  m.step(0x511a, 13); // ld (0xa8a0),a

  regs.xor(regs.a);
  m.step(0x511b, 4); // xor a

  mem.write8(0xa8a4, regs.a);
  m.step(0x511e, 13); // ld (0xa8a4),a

  m.step(0x51de, 10); // jp 0x51de -- TAIL, nothing pushed
  return m.call(0x51de);
}
