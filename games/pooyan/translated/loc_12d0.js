// SPDX-License-Identifier: GPL-3.0-only

// loc_12d0  (ROM 0x12d0-0x12fa) -- table lookup + object-field compare/dispatch. Index
// (0x8907 & 0x1f) >> 2 selects a word from table 0x12fb via loc_0c45 (-> DE), ex de,hl; then
// rst 0x20 keyed by (0x8d41 & 0x0f) fetches a target byte into A -> C. Compares object field
// (ix+0x06): equal -> tail jp 0x1383; below 0x14 -> ret; else set (ix+0x08)=1, DE=0x3838,
// tail jp 0x381e. Code-level; MAME grounding pending.
export function loc_12d0(m) {
  const { regs, mem } = m;

  regs.hl = 0x12fb;             m.step(0x12d3, 10);
  regs.a = mem.read8(0x8907);   m.step(0x12d6, 13);
  regs.and(0x1f);               m.step(0x12d8, 7);
  regs.a = regs.srl(regs.a);    m.step(0x12da, 8);
  regs.a = regs.srl(regs.a);    m.step(0x12dc, 8);
  m.push16(0x12df); m.step(0x0c45, 17); m.call(0x0c45); // 12dc  call 0x0c45 -- DE = table[A]
  regs.exDeHl();                m.step(0x12e0, 4);
  regs.a = mem.read8(0x8d41);   m.step(0x12e3, 13);
  regs.and(0x0f);               m.step(0x12e5, 7);
  m.push16(0x12e6); m.step(0x0020, 11); m.call(0x0020); // 12e5  rst 0x20 -- HL+=A, A=(HL)
  regs.c = regs.a;              m.step(0x12e7, 4);
  regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x12ea, 19);
  regs.cp(regs.c);              m.step(0x12eb, 4);
  if (regs.fZ) { m.step(0x1383, 10); return m.call(0x1383); } // 12eb  jp z,0x1383 (tail)
  m.step(0x12ee, 10);
  regs.cp(0x14);                m.step(0x12f0, 7);
  if (regs.fC) { m.ret(11); return; } // 12f0  ret c (field < 0x14)
  m.step(0x12f1, 5);
  mem.write8((regs.ix + 0x08) & 0xffff, 0x01); m.step(0x12f5, 19);
  regs.de = 0x3838;             m.step(0x12f8, 10);
  m.step(0x381e, 10); return m.call(0x381e); // 12f8  jp 0x381e (tail)
}
