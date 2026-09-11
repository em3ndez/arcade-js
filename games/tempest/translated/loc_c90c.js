// SPDX-License-Identifier: GPL-3.0-only
// loc_c90c  (ROM 0xc90c-0xc93f) -- jsr aba2/c16e (and ca62 if $05<0), clear $49, then for X=$3d=$3e..0
// init per-slot arrays $0048[x]=$0158 and $0046[x]=0xff, clear $3f/$0115, $3d=$3e, jmp 0x90c4 (tail).
export function loc_c90c(m) {
  const { regs, mem } = m;
  m.push16(0xc90e); m.step(0xc90f, 6); m.call(0xaba2);
  m.push16(0xc911); m.step(0xc912, 6); m.call(0xc16e);
  regs.a = mem.read8(0x05); regs.setNZ(regs.a); m.step(0xc914, 3);
  // c914 bpl 0xc919
  if (regs.fPl) {
    m.step(0xc919, 3);
  } else {
    m.step(0xc916, 2);
    m.push16(0xc918); m.step(0xc919, 6); m.call(0xca62);
  }
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xc91b, 2);
  mem.write8(0x49, regs.a); m.step(0xc91d, 3);
  regs.x = mem.read8(0x3e); regs.setNZ(regs.x); m.step(0xc91f, 3);
  mem.write8(0x3d, regs.x); m.step(0xc921, 3);
  // c921..c930 loop (X=$3d from $3e down to <0)
  while (true) {
    regs.x = mem.read8(0x3d); regs.setNZ(regs.x); m.step(0xc923, 3);
    regs.a = mem.read8(0x0158); regs.setNZ(regs.a); m.step(0xc926, 4);
    mem.write8((0x0048 + regs.x) & 0xffff, regs.a); m.step(0xc929, 5);
    regs.a = 0xff; regs.setNZ(regs.a); m.step(0xc92b, 2);
    mem.write8((0x0046 + regs.x) & 0xffff, regs.a); m.step(0xc92e, 5);
    { const v = (mem.read8(0x3d) - 1) & 0xff; mem.write8(0x3d, v); regs.setNZ(v); } m.step(0xc930, 5);
    if (regs.fPl) { m.step(0xc921, 3); continue; }
    m.step(0xc932, 2); break;
  }
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xc934, 2);
  mem.write8(0x3f, regs.a); m.step(0xc936, 3);
  mem.write8(0x0115, regs.a); m.step(0xc939, 4);
  regs.a = mem.read8(0x3e); regs.setNZ(regs.a); m.step(0xc93b, 3);
  mem.write8(0x3d, regs.a); m.step(0xc93d, 3);
  m.step(0x90c4, 3); return m.call(0x90c4);
}
