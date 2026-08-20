// SPDX-License-Identifier: GPL-3.0-only

// loc_5b06  (ROM 0x5b06-0x5b2b) -- checksum gate: only when (0x8907)==5, sum the 6 bytes at
// DE=0x1553 (iy=0x5315 copied byte-swapped: d=iyl, e=iyh) carrying into H, then test L+H+0x7f;
// a nonzero result bumps the counter at 0x881e.
export function loc_5b06(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8907);       m.step(0x5b09, 13);
  regs.cp(0x05);                    m.step(0x5b0b, 7);
  if (regs.fNZ) { return m.ret(11); } // 5b0b ret nz -- not the guarded state
  m.step(0x5b0c, 5);
  regs.iy = 0x5315;                 m.step(0x5b10, 14);
  regs.d = regs.iy & 0xff;          m.step(0x5b12, 8);  // ld d,iyl
  regs.e = (regs.iy >> 8) & 0xff;   m.step(0x5b14, 8);  // ld e,iyh
  regs.xor(regs.a);                 m.step(0x5b15, 4);
  regs.l = regs.a;                  m.step(0x5b16, 4);
  regs.h = regs.a;                  m.step(0x5b17, 4);
  regs.b = 0x06;                    m.step(0x5b19, 7);

  for (;;) { // 5b19
    regs.a = mem.read8(regs.de);      m.step(0x5b1a, 7);
    regs.add(regs.l);                 m.step(0x5b1b, 4);
    if (regs.fC) {
      m.step(0x5b1d, 7);              // jr nc not taken
      regs.h = regs.inc8(regs.h);     m.step(0x5b1e, 4);
    } else {
      m.step(0x5b1e, 12);             // jr nc taken
    }
    regs.l = regs.a;                  m.step(0x5b1f, 4);
    regs.de = (regs.de + 1) & 0xffff; m.step(0x5b20, 6);
    if (regs.djnz()) { m.step(0x5b19, 13); } else { m.step(0x5b22, 8); break; }
  }

  regs.add(regs.h);                 m.step(0x5b23, 4);
  regs.add(0x7f);                   m.step(0x5b25, 7);
  if (regs.fZ) { return m.ret(11); } // 5b25 ret z -- checksum balances
  m.step(0x5b26, 5);
  regs.h = 0x88;                    m.step(0x5b28, 7);
  regs.l = 0x1e;                    m.step(0x5b2a, 7);
  regs.incMem8(mem, regs.hl);       m.step(0x5b2b, 11);
  return m.ret(10);                 // 5b2b ret
}
