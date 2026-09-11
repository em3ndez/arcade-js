// SPDX-License-Identifier: GPL-3.0-only
// loc_a888  (ROM 0xa888-0xa8ae) -- when $0125>=3 and even, scans $02df,y down for a nonzero entry;
// found -> clear bits0-1 of $028a,y and tail-jmp loc_a398; none -> zero $0125; else rts.
export function loc_a888(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0125); regs.setNZ(regs.a); m.step(0xa88b, 4);
  regs.cmp(0x03); m.step(0xa88d, 2);
  if (regs.fNC) { m.step(0xa8a3, 3); return m.ret(6); }
  m.step(0xa88f, 2);
  regs.and(0x01); m.step(0xa891, 2);
  if (regs.fNZ) { m.step(0xa8a3, 3); return m.ret(6); }
  m.step(0xa893, 2);
  regs.y = mem.read8(0x011c); regs.setNZ(regs.y); m.step(0xa896, 4);
  while (true) {
    regs.a = mem.read8((0x02df + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa899, 4);
    if (regs.fNZ) {
      m.step(0xa8a4, 3);
      regs.a = mem.read8((0x028a + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa8a7, 4);
      regs.and(0xfc); m.step(0xa8a9, 2);
      mem.write8((0x028a + regs.y) & 0xffff, regs.a); m.step(0xa8ac, 5);
      m.step(0xa398, 3); return m.call(0xa398);
    }
    m.step(0xa89b, 2);
    regs.y = regs.dec8(regs.y); m.step(0xa89c, 2);
    if (regs.fPl) { m.step(0xa896, 3); continue; }
    m.step(0xa89e, 2);
    break;
  }
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa8a0, 2);
  mem.write8(0x0125, regs.a); m.step(0xa8a3, 4);
  return m.ret(6);
}
