// SPDX-License-Identifier: GPL-3.0-only
// loc_c3ba  (ROM 0xc3ba-0xc3ed) -- 16-bit deltas: $6e/$6f = $61/$62 - $6a/$6b, $70/$71 = $63/$64 - $6c/$6d
// (two sec'd subtracts), calls $df92 with X=$6e, then copies $61-$64 -> $6a-$6d, sets $73=0xc0; rts.
export function loc_c3ba(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x61); regs.setNZ(regs.a); m.step(0xc3bc, 3);
  regs.sec(); m.step(0xc3bd, 2);
  regs.sbc(mem.read8(0x6a)); m.step(0xc3bf, 3);
  mem.write8(0x6e, regs.a); m.step(0xc3c1, 3);
  regs.a = mem.read8(0x62); regs.setNZ(regs.a); m.step(0xc3c3, 3);
  regs.sbc(mem.read8(0x6b)); m.step(0xc3c5, 3);
  mem.write8(0x6f, regs.a); m.step(0xc3c7, 3);
  regs.a = mem.read8(0x63); regs.setNZ(regs.a); m.step(0xc3c9, 3);
  regs.sec(); m.step(0xc3ca, 2);
  regs.sbc(mem.read8(0x6c)); m.step(0xc3cc, 3);
  mem.write8(0x70, regs.a); m.step(0xc3ce, 3);
  regs.a = mem.read8(0x64); regs.setNZ(regs.a); m.step(0xc3d0, 3);
  regs.sbc(mem.read8(0x6d)); m.step(0xc3d2, 3);
  mem.write8(0x71, regs.a); m.step(0xc3d4, 3);
  regs.x = 0x6e; regs.setNZ(regs.x); m.step(0xc3d6, 2);
  m.push16((0xc3d6 + 2) & 0xffff); m.step(0xc3d9, 6); m.call(0xdf92);
  regs.a = mem.read8(0x61); regs.setNZ(regs.a); m.step(0xc3db, 3);
  mem.write8(0x6a, regs.a); m.step(0xc3dd, 3);
  regs.a = mem.read8(0x62); regs.setNZ(regs.a); m.step(0xc3df, 3);
  mem.write8(0x6b, regs.a); m.step(0xc3e1, 3);
  regs.a = mem.read8(0x63); regs.setNZ(regs.a); m.step(0xc3e3, 3);
  mem.write8(0x6c, regs.a); m.step(0xc3e5, 3);
  regs.a = mem.read8(0x64); regs.setNZ(regs.a); m.step(0xc3e7, 3);
  mem.write8(0x6d, regs.a); m.step(0xc3e9, 3);
  regs.a = 0xc0; regs.setNZ(regs.a); m.step(0xc3eb, 2);
  mem.write8(0x73, regs.a); m.step(0xc3ed, 3);
  return m.ret(6);
}
