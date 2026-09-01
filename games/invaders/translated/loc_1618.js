// SPDX-License-Identifier: GPL-3.0-only
// loc_1618  (ROM 0x1618-0x166a) -- called from 0x081f/0x0b71. Gated pre-round advance: bails unless
// 0x2015==0xff and 0x2010/0x2011 and 0x2025 are clear, then either arms via 0x17c0 or steps 0x20ed.
export function loc_1618(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x2015); m.step(0x161b, 13); // 1618  lda 0x2015
  regs.cp(0xff); m.step(0x161d, 7); // 161b  cpi 0xff
  if (regs.fNZ) { return m.ret(11); } // 161d  rnz
  m.step(0x161e, 5);
  regs.hl = 0x2010; m.step(0x1621, 10); // 161e  lxi h,0x2010
  regs.a = mem.read8(regs.hl); m.step(0x1622, 7);
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x1623, 5);
  regs.b = mem.read8(regs.hl); m.step(0x1624, 7);
  regs.or(regs.b); m.step(0x1625, 4); // 1624  ora b
  if (regs.fNZ) { return m.ret(11); } // 1625  rnz
  m.step(0x1626, 5);
  regs.a = mem.read8(0x2025); m.step(0x1629, 13); // 1626  lda 0x2025
  regs.and(regs.a); m.step(0x162a, 4);
  if (regs.fNZ) { return m.ret(11); } // 162a  rnz
  m.step(0x162b, 5);
  regs.a = mem.read8(0x20ef); m.step(0x162e, 13); // 162b  lda 0x20ef
  regs.and(regs.a); m.step(0x162f, 4);

  if (regs.fZ) { // 162f  jz 0x1652
    m.step(0x1652, 10);
    regs.hl = 0x2025; m.step(0x1655, 10); // 1652  lxi h,0x2025
    mem.write8(regs.hl, 0x01); m.step(0x1657, 10); // 1655  mvi m,0x01
    regs.hl = mem.read16(0x20ed); m.step(0x165a, 16); // 1657  lhld 0x20ed
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x165b, 5);
    regs.a = regs.l; m.step(0x165c, 5);
    regs.cp(0x7e); m.step(0x165e, 7); // 165c  cpi 0x7e
    if (regs.fNC) { m.step(0x1661, 10); regs.l = 0x74; m.step(0x1663, 7); } // 165e jc (nt) + 1661 mvi l,0x74
    else { m.step(0x1663, 10); } // 165e  jc 0x1663 (taken)
    mem.write16(0x20ed, regs.hl); m.step(0x1666, 16); // 1663  shld 0x20ed
    regs.a = mem.read8(regs.hl); m.step(0x1667, 7);
    mem.write8(0x201d, regs.a); m.step(0x166a, 13); // 1667  sta 0x201d
    return m.ret(10); // 166a  ret
  }
  m.step(0x1632, 10); // 162f  jz not taken

  regs.a = mem.read8(0x202d); m.step(0x1635, 13); // 1632  lda 0x202d
  regs.and(regs.a); m.step(0x1636, 4);
  if (regs.fNZ) { // 1636  jnz 0x1648
    m.step(0x1648, 10);
    m.push16(0x164b); m.step(0x17c0, 17); m.call(0x17c0); // 1648  call 0x17c0
    regs.and(0x10); m.step(0x164d, 7); // 164b  ani 0x10
    if (regs.fNZ) { return m.ret(11); } // 164d  rnz
    m.step(0x164e, 5);
    mem.write8(0x202d, regs.a); m.step(0x1651, 13); // 164e  sta 0x202d
    return m.ret(10); // 1651  ret
  }
  m.step(0x1639, 10); // 1636  jnz not taken

  m.push16(0x163c); m.step(0x17c0, 17); m.call(0x17c0); // 1639  call 0x17c0
  regs.and(0x10); m.step(0x163e, 7); // 163c  ani 0x10
  if (regs.fZ) { return m.ret(11); } // 163e  rz
  m.step(0x163f, 5);
  regs.a = 0x01; m.step(0x1641, 7);
  mem.write8(0x2025, regs.a); m.step(0x1644, 13); // 1641  sta 0x2025
  mem.write8(0x202d, regs.a); m.step(0x1647, 13); // 1644  sta 0x202d
  return m.ret(10); // 1647  ret
}
