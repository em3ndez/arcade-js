// SPDX-License-Identifier: GPL-3.0-only
// loc_c73c  (ROM 0xc73c-0xc764) -- writes two 16-bit deltas through ($74),y at cursor $a9: ($63:$64)-($6c:$6d)
// masked to 5 bits high, then ($61:$62)-($6a:$6b) with the high byte masked 5 bits and OR'd $a0. Advances $a9.
export function loc_c73c(m) {
  const { regs, mem } = m;
  regs.y = mem.read8(0xa9); regs.setNZ(regs.y); m.step(0xc73e, 3);
  regs.a = mem.read8(0x63); regs.setNZ(regs.a); m.step(0xc740, 3);
  regs.sec(); m.step(0xc741, 2);
  regs.sbc(mem.read8(0x6c)); m.step(0xc743, 3);
  mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xc745, 6);
  regs.y = regs.inc8(regs.y); m.step(0xc746, 2);
  regs.a = mem.read8(0x64); regs.setNZ(regs.a); m.step(0xc748, 3);
  regs.sbc(mem.read8(0x6d)); m.step(0xc74a, 3);
  regs.and(0x1f); m.step(0xc74c, 2);
  mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xc74e, 6);
  regs.y = regs.inc8(regs.y); m.step(0xc74f, 2);
  regs.a = mem.read8(0x61); regs.setNZ(regs.a); m.step(0xc751, 3);
  regs.sec(); m.step(0xc752, 2);
  regs.sbc(mem.read8(0x6a)); m.step(0xc754, 3);
  mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xc756, 6);
  regs.y = regs.inc8(regs.y); m.step(0xc757, 2);
  regs.a = mem.read8(0x62); regs.setNZ(regs.a); m.step(0xc759, 3);
  regs.sbc(mem.read8(0x6b)); m.step(0xc75b, 3);
  regs.and(0x1f); m.step(0xc75d, 2);
  regs.ora(0xa0); m.step(0xc75f, 2);
  mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xc761, 6);
  regs.y = regs.inc8(regs.y); m.step(0xc762, 2);
  mem.write8(0xa9, regs.y); m.step(0xc764, 3);
  return m.ret(6);
}
