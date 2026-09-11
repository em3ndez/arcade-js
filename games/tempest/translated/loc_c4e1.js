// SPDX-License-Identifier: GPL-3.0-only
// loc_c4e1  (ROM 0xc4e1-0xc54c) -- gets A/X from loc_c2e8 into $36/$35, sets up a vector-draw
// (jsr df6a/df4c/df75), then for X=$38=0x0f..0 walks $b97c/$ba7c[Y] deltas emitting segments via
// df75, and finally jmp df6a (tail) with A=1.
export function loc_c4e1(m) {
  const { regs, mem } = m;
  m.push16(0xc4e3); m.step(0xc4e4, 6); m.call(0xc2e8);
  mem.write8(0x36, regs.a); m.step(0xc4e6, 3);
  mem.write8(0x35, regs.x); m.step(0xc4e8, 3);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xc4ea, 2);
  mem.write8(0x73, regs.a); m.step(0xc4ec, 3);
  regs.a = 0x05; regs.setNZ(regs.a); m.step(0xc4ee, 2);
  m.push16(0xc4f0); m.step(0xc4f1, 6); m.call(0xdf6a);
  regs.a = mem.read8(0x35); regs.setNZ(regs.a); m.step(0xc4f3, 3);
  regs.and(0x07); m.step(0xc4f5, 2);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0xc4f6, 2);
  { const a = (0xc22d + regs.x) & 0xffff;
    regs.y = mem.read8(a); regs.setNZ(regs.y); m.step(0xc4f9, 4 + ((0xc22d & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
  mem.write8(0x9e, regs.y); m.step(0xc4fb, 3);
  regs.a = 0x08; regs.setNZ(regs.a); m.step(0xc4fd, 2);
  m.push16(0xc4ff); m.step(0xc500, 6); m.call(0xdf4c);
  regs.x = mem.read8(0x0112); regs.setNZ(regs.x); m.step(0xc503, 4);
  regs.a = mem.read8(0x36); regs.setNZ(regs.a); m.step(0xc505, 3);
  { const a = (0xbccc + regs.x) & 0xffff;
    regs.y = mem.read8(a); regs.setNZ(regs.y); m.step(0xc508, 4 + ((0xbccc & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
  // c508 bne 0xc50d
  if (regs.fNZ) {
    m.step(0xc50d, 3);
  } else {
    m.step(0xc50a, 2);
    regs.sec(); m.step(0xc50b, 2);
    regs.sbc(0x0f); m.step(0xc50d, 2);
  }
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xc50e, 2);
  { const a = (0xba7c + regs.y) & 0xffff;
    regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0xc511, 4 + ((0xba7c & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
  mem.write8(0x57, regs.a); m.step(0xc513, 3);
  regs.eor(0x80); m.step(0xc515, 2);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0xc516, 2);
  { const a = (0xb97c + regs.y) & 0xffff;
    regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0xc519, 4 + ((0xb97c & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
  mem.write8(0x56, regs.a); m.step(0xc51b, 3);
  regs.eor(0x80); m.step(0xc51d, 2);
  m.push16(0xc51f); m.step(0xc520, 6); m.call(0xdf75);
  regs.a = 0xc0; regs.setNZ(regs.a); m.step(0xc522, 2);
  mem.write8(0x73, regs.a); m.step(0xc524, 3);
  regs.x = 0x0f; regs.setNZ(regs.x); m.step(0xc526, 2);
  mem.write8(0x38, regs.x); m.step(0xc528, 3);
  // c528..c546 loop
  while (true) {
    regs.y = mem.read8(0x36); regs.setNZ(regs.y); m.step(0xc52a, 3);
    { const a = (0xb97c + regs.y) & 0xffff;
      regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0xc52d, 4 + ((0xb97c & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
    regs.x = regs.a; regs.setNZ(regs.x); m.step(0xc52e, 2);
    regs.sec(); m.step(0xc52f, 2);
    regs.sbc(mem.read8(0x56)); m.step(0xc531, 3);
    m.push8(regs.a); m.step(0xc532, 3);
    mem.write8(0x56, regs.x); m.step(0xc534, 3);
    { const a = (0xba7c + regs.y) & 0xffff;
      regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0xc537, 4 + ((0xba7c & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
    regs.y = regs.a; regs.setNZ(regs.y); m.step(0xc538, 2);
    regs.sec(); m.step(0xc539, 2);
    regs.sbc(mem.read8(0x57)); m.step(0xc53b, 3);
    regs.x = regs.a; regs.setNZ(regs.x); m.step(0xc53c, 2);
    mem.write8(0x57, regs.y); m.step(0xc53e, 3);
    regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xc53f, 4);
    m.push16(0xc541); m.step(0xc542, 6); m.call(0xdf75);
    { const v = (mem.read8(0x36) - 1) & 0xff; mem.write8(0x36, v); regs.setNZ(v); } m.step(0xc544, 5);
    { const v = (mem.read8(0x38) - 1) & 0xff; mem.write8(0x38, v); regs.setNZ(v); } m.step(0xc546, 5);
    if (regs.fPl) { m.step(0xc528, 3); continue; }
    m.step(0xc548, 2); break;
  }
  regs.a = 0x01; regs.setNZ(regs.a); m.step(0xc54a, 2);
  m.step(0xdf6a, 3); return m.call(0xdf6a);
}
