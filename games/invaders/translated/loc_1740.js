// SPDX-License-Identifier: GPL-3.0-only
// loc_1740  (ROM 0x1740-0x176c) -- shot/sound step: tick the 0x209b timer (cz sound-off 0x176d at zero),
// bail on the 0x2068 flag, tick 0x2096; emit mem[0x2098] to port 5, and if 0x2082 set, re-seed the step and reload 0x209b=4.
export function loc_1740(m) {
  const { regs, mem } = m;

  regs.hl = 0x209b; m.step(0x1743, 10);
  regs.decMem8(mem, regs.hl); m.step(0x1744, 10); // 1743  dcr m
  if (regs.fZ) { m.push16(0x1747); m.step(0x176d, 17); m.call(0x176d); }
  else { m.step(0x1747, 11); }
  regs.a = mem.read8(0x2068); m.step(0x174a, 13); // 1747  lda 0x2068
  regs.and(regs.a); m.step(0x174b, 4); // 174a  ana a
  if (regs.fZ) { m.step(0x176d, 10); return m.call(0x176d); }
  m.step(0x174e, 10);
  regs.hl = 0x2096; m.step(0x1751, 10); // 174e  lxi h,0x2096
  regs.decMem8(mem, regs.hl); m.step(0x1752, 10); // 1751  dcr m
  if (regs.fNZ) { return m.ret(11); }
  m.step(0x1753, 5);
  regs.hl = 0x2098; m.step(0x1756, 10); // 1753  lxi h,0x2098
  regs.a = mem.read8(regs.hl); m.step(0x1757, 7); // 1756  mov a,m
  m.io.portOut(0x05, regs.a); m.step(0x1759, 10); // 1757  out 0x05
  regs.a = mem.read8(0x2082); m.step(0x175c, 13); // 1759  lda 0x2082
  regs.and(regs.a); m.step(0x175d, 4); // 175c  ana a
  if (regs.fZ) { m.step(0x176d, 10); return m.call(0x176d); }
  m.step(0x1760, 10);
  regs.hl = (regs.hl - 1) & 0xffff; m.step(0x1761, 5); // 1760  dcx h
  regs.a = mem.read8(regs.hl); m.step(0x1762, 7); // 1761  mov a,m
  regs.hl = (regs.hl - 1) & 0xffff; m.step(0x1763, 5); // 1762  dcx h
  mem.write8(regs.hl, regs.a); m.step(0x1764, 7); // 1763  mov m,a
  regs.hl = (regs.hl - 1) & 0xffff; m.step(0x1765, 5); // 1764  dcx h
  mem.write8(regs.hl, 0x01); m.step(0x1767, 10); // 1765  mvi m,0x01
  regs.a = 0x04; m.step(0x1769, 7); // 1767  mvi a,0x04
  mem.write8(0x209b, regs.a); m.step(0x176c, 13); // 1769  sta 0x209b
  return m.ret(10); // 176c  ret
}
