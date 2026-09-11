// SPDX-License-Identifier: GPL-3.0-only
// loc_cd95  (ROM 0xcd95-0xcddd) -- clears $60cf/$60df/$0720, polls $60ca/$60da stability over X=4..0,
//   then reloads $60cf/$60df=7 and zeroes the $c0/$d0/$60c0/$60d0,x slot arrays + $60c8/$60d8. Intra-routine.
export function loc_cd95(m) {
  const { regs, mem } = m;
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xcd97, 2);
  mem.write8(0x60cf, regs.a); m.step(0xcd9a, 4);
  mem.write8(0x60df, regs.a); m.step(0xcd9d, 4);
  mem.write8(0x0720, regs.a); m.step(0xcda0, 4);
  regs.x = 0x04; regs.setNZ(regs.x); m.step(0xcda2, 2);
  regs.a = mem.read8(0x60ca); regs.setNZ(regs.a); m.step(0xcda5, 4);
  regs.y = mem.read8(0x60da); regs.setNZ(regs.y); m.step(0xcda8, 4);
  while (true) {
    regs.cmp(mem.read8(0x60ca)); m.step(0xcdab, 4);
    if (!regs.fZ) { m.step(0xcdb0, 3); }
    else {
      m.step(0xcdad, 2);
      regs.cpy(mem.read8(0x60da)); m.step(0xcdb0, 4);
    }
    if (regs.fZ) { m.step(0xcdb7, 3); }
    else {
      m.step(0xcdb2, 2);
      mem.write8(0x0720, regs.a); m.step(0xcdb5, 4);
      regs.x = 0x00; regs.setNZ(regs.x); m.step(0xcdb7, 2);
    }
    regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0xcdb8, 2);
    if (!regs.fN) { m.step(0xcda8, 3); continue; }
    m.step(0xcdba, 2);
    break;
  }
  regs.a = 0x07; regs.setNZ(regs.a); m.step(0xcdbc, 2);
  mem.write8(0x60cf, regs.a); m.step(0xcdbf, 4);
  mem.write8(0x60df, regs.a); m.step(0xcdc2, 4);
  regs.x = 0x07; regs.setNZ(regs.x); m.step(0xcdc4, 2);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xcdc6, 2);
  while (true) {
    mem.write8((0x60c0 + regs.x) & 0xffff, regs.a); m.step(0xcdc9, 5);
    mem.write8((0x60d0 + regs.x) & 0xffff, regs.a); m.step(0xcdcc, 5);
    mem.write8((0xc0 + regs.x) & 0xff, regs.a); m.step(0xcdce, 4);
    mem.write8((0xd0 + regs.x) & 0xff, regs.a); m.step(0xcdd0, 4);
    regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0xcdd1, 2);
    if (!regs.fN) { m.step(0xcdc6, 3); continue; }
    m.step(0xcdd3, 2);
    break;
  }
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xcdd5, 2);
  mem.write8(0x60c8, regs.a); m.step(0xcdd8, 4);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xcdda, 2);
  mem.write8(0x60d8, regs.a); m.step(0xcddd, 4);
  return m.ret(6);
}
