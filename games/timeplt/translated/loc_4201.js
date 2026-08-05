// SPDX-License-Identifier: GPL-3.0-only

// loc_4201  (ROM 0x4201–0x421E)
export function loc_4201(m) {
  const { regs, mem } = m;
  const IX = (d) => (regs.ix + d) & 0xffff;

  regs.a = mem.read8(IX(0x01));
  m.step(0x4204, 19); // ld a,(ix+0x01)
  regs.sub(mem.read8(IX(0x02)));
  m.step(0x4207, 19); // sub (ix+0x02)
  regs.add(0x01);
  m.step(0x4209, 7); // add a,0x01
  regs.cp(0x02);
  m.step(0x420b, 7); // cp 0x02
  if (regs.fC) {
    m.ret(11); // ret c -- already within one
    return;
  }
  m.step(0x420c, 5); // ret c NOT taken

  regs.cp(0x80);
  m.step(0x420e, 7); // cp 0x80
  regs.a = mem.read8(IX(0x02)); // flag-neutral -- the cp's carry survives
  m.step(0x4211, 19); // ld a,(ix+0x02)
  if (regs.fNC) {
    m.step(0x4219, 12); // jr nc,0x4219 TAKEN
    regs.sub(0x01);
    m.step(0x421b, 7); // sub 0x01
    mem.write8(IX(0x02), regs.a);
    m.step(0x421e, 19); // ld (ix+0x02),a
    m.ret(); // 421e
    return;
  }
  m.step(0x4213, 7); // jr nc NOT taken -- step up

  regs.add(0x01);
  m.step(0x4215, 7); // add a,0x01
  mem.write8(IX(0x02), regs.a);
  m.step(0x4218, 19); // ld (ix+0x02),a
  m.ret(); // 4218
}
