// SPDX-License-Identifier: GPL-3.0-only
// loc_994d  (ROM 0x994d-0x99a4) -- scans the $02df active-slot table (y=$011c..0) for a free entry; on
// finding one, seeds its parallel arrays ($02df/$02b9/$02cc/$02a6/$028a/$0291/$0283 from $29/$2a/$2c/$2d/
// $2b), bumps the active count $0108 and the per-lane counter $0142,x, returns A=0x10 (Z clear). If none
// free, restores y=$36, returns A=0 (Z set).
export function loc_994d(m) {
  const { regs, mem } = m;
  mem.write8(0x36, regs.y); m.step(0x994f, 3);
  regs.y = mem.read8(0x011c); regs.setNZ(regs.y); m.step(0x9952, 4);
  while (true) {
    regs.a = mem.read8((0x02df + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0x9955, 4);
    if (regs.fNZ) {
      m.step(0x999d, 3);
      regs.y = (regs.y - 1) & 0xff; regs.setNZ(regs.y); m.step(0x999e, 2);
      if (!regs.fN) { m.step(0x9952, 3); continue; }
      m.step(0x99a0, 2);
      regs.y = mem.read8(0x36); regs.setNZ(regs.y); m.step(0x99a2, 3);
      regs.a = 0x00; regs.setNZ(regs.a); m.step(0x99a4, 2);
      return m.ret(6);
    }
    m.step(0x9957, 2); break;
  }
  // 9957 block: found a free slot at index y
  regs.a = mem.read8(0x29); regs.setNZ(regs.a); m.step(0x9959, 3);
  mem.write8((0x02df + regs.y) & 0xffff, regs.a); m.step(0x995c, 5);
  regs.a = mem.read8(0x2a); regs.setNZ(regs.a); m.step(0x995e, 3);
  regs.cmp(0x0f); m.step(0x9960, 2);
  if (regs.fNZ) {
    m.step(0x996c, 3);
  } else {
    m.step(0x9962, 2);
    regs.bit(mem.read8(0x0111)); m.step(0x9965, 4);
    if (!regs.fN) {
      m.step(0x996c, 3);
    } else {
      m.step(0x9967, 2);
      regs.a = mem.read8(0x60ca); regs.setNZ(regs.a); m.step(0x996a, 4);
      regs.and(0x0e); m.step(0x996c, 2);
    }
  }
  // 996c
  mem.write8((0x02b9 + regs.y) & 0xffff, regs.a); m.step(0x996f, 5);
  regs.clc(); m.step(0x9970, 2);
  regs.adc(0x01); m.step(0x9972, 2);
  regs.and(0x0f); m.step(0x9974, 2);
  mem.write8((0x02cc + regs.y) & 0xffff, regs.a); m.step(0x9977, 5);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0x9979, 2);
  mem.write8((0x02a6 + regs.y) & 0xffff, regs.a); m.step(0x997c, 5);
  regs.a = mem.read8(0x2c); regs.setNZ(regs.a); m.step(0x997e, 3);
  mem.write8((0x028a + regs.y) & 0xffff, regs.a); m.step(0x9981, 5);
  regs.a = mem.read8(0x2d); regs.setNZ(regs.a); m.step(0x9983, 3);
  mem.write8((0x0291 + regs.y) & 0xffff, regs.a); m.step(0x9986, 5);
  { const v = (mem.read8(0x0108) + 1) & 0xff; mem.write8(0x0108, v); regs.setNZ(v); } m.step(0x9989, 6);
  regs.a = mem.read8(0x2b); regs.setNZ(regs.a); m.step(0x998b, 3);
  mem.write8((0x0283 + regs.y) & 0xffff, regs.a); m.step(0x998e, 5);
  regs.y = mem.read8(0x36); regs.setNZ(regs.y); m.step(0x9990, 3);
  regs.and(0x07); m.step(0x9992, 2);
  mem.write8(0x36, regs.x); m.step(0x9994, 3);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0x9995, 2);
  { const v = (mem.read8((0x0142 + regs.x) & 0xffff) + 1) & 0xff; mem.write8((0x0142 + regs.x) & 0xffff, v); regs.setNZ(v); } m.step(0x9998, 7);
  regs.x = mem.read8(0x36); regs.setNZ(regs.x); m.step(0x999a, 3);
  regs.a = 0x10; regs.setNZ(regs.a); m.step(0x999c, 2);
  return m.ret(6);
}
