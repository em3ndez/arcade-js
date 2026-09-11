// SPDX-License-Identifier: GPL-3.0-only
// loc_ad22  (ROM 0xad22-0xad6d) -- loop over the $0603 request nibbles: pick slot ($0600,x), if in
// range 1..8 build $0602 (=-(2*n+n)-0xe5), seed $0604/$0605/$4e/$50, jsr $ca48 + $a789, exit Y->$00.
export function loc_ad22(m) {
  const { regs, mem } = m;
  while (true) {
    regs.y = 0x14; regs.setNZ(regs.y); m.step(0xad24, 2);
    regs.a = mem.read8(0x0603); regs.setNZ(regs.a); m.step(0xad27, 4);
    if (regs.fZ) {
      m.step(0xad6b, 3);
      mem.write8(0x0000, regs.y); m.step(0xad6d, 3);
      return m.ret(6);
    }
    m.step(0xad29, 2);
    regs.and(0x03); m.step(0xad2b, 2);
    mem.write8(0x003d, regs.a); m.step(0xad2d, 3);
    mem.write8(0x003d, regs.dec8(mem.read8(0x003d))); m.step(0xad2f, 5);
    mem.write8(0x0603, regs.lsr(mem.read8(0x0603))); m.step(0xad32, 6);
    mem.write8(0x0603, regs.lsr(mem.read8(0x0603))); m.step(0xad35, 6);
    regs.x = mem.read8(0x003d); regs.setNZ(regs.x); m.step(0xad37, 3);
    regs.a = mem.read8((0x0600 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xad3a, 4);
    if (regs.fZ) { m.step(0xad68, 3); m.step(0xad22, 3); continue; }
    m.step(0xad3c, 2);
    regs.cmp(0x09); m.step(0xad3e, 2);
    if (regs.fC) { m.step(0xad68, 3); m.step(0xad22, 3); continue; }
    m.step(0xad40, 2);
    regs.a = regs.asl(regs.a); m.step(0xad41, 2);
    regs.clc(); m.step(0xad42, 2);
    regs.adc(mem.read8((0x0600 + regs.x) & 0xffff)); m.step(0xad45, 4);
    regs.eor(0xff); m.step(0xad47, 2);
    regs.sec(); m.step(0xad48, 2);
    regs.sbc(0xe5); m.step(0xad4a, 2);
    mem.write8(0x0602, regs.a); m.step(0xad4d, 4);
    m.push16(0xad4f); m.step(0xad50, 6); m.call(0xca48);
    regs.a = 0x60; regs.setNZ(regs.a); m.step(0xad52, 2);
    mem.write8(0x0605, regs.a); m.step(0xad55, 4);
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0xad57, 2);
    mem.write8(0x004e, regs.a); m.step(0xad59, 3);
    mem.write8(0x0050, regs.a); m.step(0xad5b, 3);
    regs.a = 0x02; regs.setNZ(regs.a); m.step(0xad5d, 2);
    mem.write8(0x0604, regs.a); m.step(0xad60, 4);
    m.push16(0xad62); m.step(0xad63, 6); m.call(0xa789);
    regs.y = 0x24; regs.setNZ(regs.y); m.step(0xad65, 2);
    mem.write8(0x0000, regs.y); m.step(0xad67, 3);
    return m.ret(6);
  }
}
