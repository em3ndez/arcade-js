// SPDX-License-Identifier: GPL-3.0-only
// loc_14d8  (ROM 0x14d8-0x1537) -- bonus/state-0x02 handler: acts only when state 0x2025 == 0x02
// (rets for 0x05 and anything else). Commits a landed prize or bails to loc_1530; loc_1504/loc_1530 interior.
export function loc_14d8(m) {
  const { regs, mem } = m;

  const loc_1530 = () => { // interior bail arm: force state 3, tail-jump into loc_154a
    regs.a = 0x03; m.step(0x1532, 7); // 1530  mvi a,0x03
    mem.write8(0x2025, regs.a); m.step(0x1535, 13); // 1532  sta 0x2025
    m.step(0x154a, 10); return m.call(0x154a); // 1535  jmp 0x154a
  };

  regs.a = mem.read8(0x2025); m.step(0x14db, 13); // 14d8  lda 0x2025
  regs.cp(0x05); m.step(0x14dd, 7); // 14db  cpi 0x05
  if (regs.fZ) { return m.ret(11); } m.step(0x14de, 5);
  regs.cp(0x02); m.step(0x14e0, 7); // 14de  cpi 0x02
  if (regs.fNZ) { return m.ret(11); } m.step(0x14e1, 5);
  regs.a = mem.read8(0x2029); m.step(0x14e4, 13); // 14e1  lda 0x2029
  regs.cp(0xd8); m.step(0x14e6, 7); // 14e4  cpi 0xd8
  regs.b = regs.a; m.step(0x14e7, 5); // 14e6  mov b,a
  if (regs.fNC) { m.step(0x1530, 10); return loc_1530(); }
  m.step(0x14ea, 10);
  regs.a = mem.read8(0x2002); m.step(0x14ed, 13); // 14ea  lda 0x2002
  regs.and(regs.a); m.step(0x14ee, 4); // 14ed  ana a
  if (regs.fZ) { return m.ret(11); } m.step(0x14ef, 5);
  regs.a = regs.b; m.step(0x14f0, 5); // 14ef  mov a,b
  regs.cp(0xce); m.step(0x14f2, 7); // 14f0  cpi 0xce
  if (regs.fNC) { m.step(0x1579, 10); return m.call(0x1579); }
  m.step(0x14f5, 10);
  regs.add(0x06); m.step(0x14f7, 7); // 14f5  adi 0x06
  regs.b = regs.a; m.step(0x14f8, 5); // 14f7  mov b,a
  regs.a = mem.read8(0x2009); m.step(0x14fb, 13); // 14f8  lda 0x2009
  regs.cp(0x90); m.step(0x14fd, 7); // 14fb  cpi 0x90
  if (regs.fNC) {
    m.step(0x1504, 10); // 14fd  jnc 0x1504
  } else {
    m.step(0x1500, 10);
    regs.cp(regs.b); m.step(0x1501, 4); // 1500  cmp b
    if (regs.fNC) { m.step(0x1530, 10); return loc_1530(); }
    m.step(0x1504, 10);
  }
  regs.l = regs.b; m.step(0x1505, 5); // 1504  mov l,b
  m.push16(0x1508); m.step(0x1562, 17); m.call(0x1562);
  regs.a = mem.read8(0x202a); m.step(0x150b, 13); // 1508  lda 0x202a
  regs.h = regs.a; m.step(0x150c, 5); // 150b  mov h,a
  m.push16(0x150f); m.step(0x156f, 17); m.call(0x156f);
  mem.write16(0x2064, regs.hl); m.step(0x1512, 16); // 150f  shld 0x2064
  regs.a = 0x05; m.step(0x1514, 7); // 1512  mvi a,0x05
  mem.write8(0x2025, regs.a); m.step(0x1517, 13); // 1514  sta 0x2025
  m.push16(0x151a); m.step(0x1581, 17); m.call(0x1581);
  regs.a = mem.read8(regs.hl); m.step(0x151b, 7); // 151a  mov a,m
  regs.and(regs.a); m.step(0x151c, 4); // 151b  ana a
  if (regs.fZ) { m.step(0x1530, 10); return loc_1530(); }
  m.step(0x151f, 10);
  mem.write8(regs.hl, 0x00); m.step(0x1521, 10); // 151f  mvi m,0x00
  m.push16(0x1524); m.step(0x0a5f, 17); m.call(0x0a5f);
  m.push16(0x1527); m.step(0x1a3b, 17); m.call(0x1a3b);
  m.push16(0x152a); m.step(0x15d3, 17); m.call(0x15d3);
  regs.a = 0x10; m.step(0x152c, 7); // 152a  mvi a,0x10
  mem.write8(0x2003, regs.a); m.step(0x152f, 13); // 152c  sta 0x2003
  return m.ret(10); // 152f  ret
}
