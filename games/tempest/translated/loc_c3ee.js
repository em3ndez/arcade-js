// SPDX-License-Identifier: GPL-3.0-only
// loc_c3ee  (ROM 0xc3ee-0xc422) -- stashes X in $37 and pushes A (a color); sets $9e-mode via $df4c, calls
// $c43c then $c772, draws with $73=savedA via $c423, decrements $37, redraws with $73=0 via $c423, restores
// $73=savedA (pla), calls $c43c then $c3ba, reloads X from $37; rts. JSRs $df4c $c43c $c772 $c423 $c3ba.
export function loc_c3ee(m) {
  const { regs, mem } = m;
  mem.write8(0x37, regs.x); m.step(0xc3f0, 3);
  m.push8(regs.a); m.step(0xc3f1, 3);
  regs.y = mem.read8(0x9e); regs.setNZ(regs.y); m.step(0xc3f3, 3);
  regs.a = 0x08; regs.setNZ(regs.a); m.step(0xc3f5, 2);
  m.push16((0xc3f5 + 2) & 0xffff); m.step(0xc3f8, 6); m.call(0xdf4c);
  m.push16((0xc3f8 + 2) & 0xffff); m.step(0xc3fb, 6); m.call(0xc43c);
  regs.x = 0x61; regs.setNZ(regs.x); m.step(0xc3fd, 2);
  m.push16((0xc3fd + 2) & 0xffff); m.step(0xc400, 6); m.call(0xc772);
  regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xc401, 4);
  mem.write8(0x73, regs.a); m.step(0xc403, 3);
  m.push8(regs.a); m.step(0xc404, 3);
  m.push16((0xc404 + 2) & 0xffff); m.step(0xc407, 6); m.call(0xc423);
  mem.write8(0x37, regs.dec8(mem.read8(0x37))); m.step(0xc409, 5);
  regs.y = mem.read8(0x9e); regs.setNZ(regs.y); m.step(0xc40b, 3);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xc40d, 2);
  mem.write8(0x73, regs.a); m.step(0xc40f, 3);
  regs.a = 0x08; regs.setNZ(regs.a); m.step(0xc411, 2);
  m.push16((0xc411 + 2) & 0xffff); m.step(0xc414, 6); m.call(0xdf4c);
  m.push16((0xc414 + 2) & 0xffff); m.step(0xc417, 6); m.call(0xc423);
  regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xc418, 4);
  mem.write8(0x73, regs.a); m.step(0xc41a, 3);
  m.push16((0xc41a + 2) & 0xffff); m.step(0xc41d, 6); m.call(0xc43c);
  m.push16((0xc41d + 2) & 0xffff); m.step(0xc420, 6); m.call(0xc3ba);
  regs.x = mem.read8(0x37); regs.setNZ(regs.x); m.step(0xc422, 3);
  return m.ret(6);
}
