// SPDX-License-Identifier: GPL-3.0-only

// loc_421f  (ROM 0x421F–0x4242)
export function loc_421f(m) {
  const { regs, mem } = m;
  const IX = (d) => (regs.ix + d) & 0xffff;

  regs.a = mem.read8(0xa980);
  m.step(0x4222, 13); // ld a,(0xa980)
  regs.and(0x03);
  m.step(0x4224, 7); // and 0x03
  if (regs.fZ) {
    m.ret(11); // ret z -- the idle tick
    return;
  }
  m.step(0x4225, 5); // ret z NOT taken

  regs.a = mem.read8(IX(0x01));
  m.step(0x4228, 19); // ld a,(ix+0x01)
  regs.sub(mem.read8(IX(0x02)));
  m.step(0x422b, 19); // sub (ix+0x02)
  regs.add(0x01);
  m.step(0x422d, 7); // add a,0x01
  regs.cp(0x02);
  m.step(0x422f, 7); // cp 0x02
  if (regs.fC) {
    m.ret(11); // ret c -- already within one
    return;
  }
  m.step(0x4230, 5); // ret c NOT taken

  regs.cp(0x80);
  m.step(0x4232, 7); // cp 0x80
  regs.a = mem.read8(IX(0x02)); // flag-neutral -- the cp's carry survives
  m.step(0x4235, 19); // ld a,(ix+0x02)
  if (regs.fNC) {
    m.step(0x423d, 12); // jr nc,0x423d TAKEN
    regs.sub(0x02);
    m.step(0x423f, 7); // sub 0x02
    mem.write8(IX(0x02), regs.a);
    m.step(0x4242, 19); // ld (ix+0x02),a
    m.ret(); // 4242
    return;
  }
  m.step(0x4237, 7); // jr nc NOT taken -- step up by two

  regs.add(0x02);
  m.step(0x4239, 7); // add a,0x02
  mem.write8(IX(0x02), regs.a);
  m.step(0x423c, 19); // ld (ix+0x02),a
  m.ret(); // 423c
}
