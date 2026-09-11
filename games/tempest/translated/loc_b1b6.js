// SPDX-License-Identifier: GPL-3.0-only
// loc_b1b6  (ROM 0xb1b6-0xb20c) -- frame/vector housekeeping: jsr 0xc1c3; early-rts if $2000==$cec6 &&
// $0133==0; if $01==0 tail-jmp 0xb230; else run b2be/b332 (bcs skip), b20d, a checksum-into-$0455 loop
// over ($b6),y, then b2fe, copy $cec4/$cec5 -> $2000/$2001, rts.
export function loc_b1b6(m) {
  const { regs, mem } = m;
  m.push16(0xb1b8); m.step(0xb1b9, 6); m.call(0xc1c3);
  regs.a = mem.read8(0x2000); regs.setNZ(regs.a); m.step(0xb1bc, 4);
  regs.cmp(mem.read8(0xcec6)); m.step(0xb1bf, 4);
  if (regs.fZ) { // b1bf bne 0xb1c7 (fall -- equal)
    m.step(0xb1c1, 2);
    regs.a = mem.read8(0x0133); regs.setNZ(regs.a); m.step(0xb1c4, 4);
    if (regs.fZ) { m.step(0xb1c6, 2); return m.ret(6); }
    m.step(0xb1c7, 3);
  } else {
    m.step(0xb1c7, 3);
  }
  regs.a = mem.read8(0x01); regs.setNZ(regs.a); m.step(0xb1c9, 3);
  regs.cmp(0x00); m.step(0xb1cb, 2);
  if (regs.fZ) { m.step(0xb209, 3); m.step(0xb230, 3); return m.call(0xb230); }
  m.step(0xb1cd, 2);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xb1cf, 2);
  m.push16(0xb1d1); m.step(0xb1d2, 6); m.call(0xb2be);
  m.push16(0xb1d4); m.step(0xb1d5, 6); m.call(0xb332);
  if (regs.fC) {
    m.step(0xb1f5, 3);
  } else {
    m.step(0xb1d7, 2);
    m.push16(0xb1d9); m.step(0xb1da, 6); m.call(0xb20d);
    regs.a = mem.read8(0x016e); regs.setNZ(regs.a); m.step(0xb1dd, 4);
    if (regs.fZ) {
      m.step(0xb1f5, 3);
    } else {
      m.step(0xb1df, 2);
      regs.y = 0x27; regs.setNZ(regs.y); m.step(0xb1e1, 2);
      regs.a = 0x0e; regs.setNZ(regs.a); m.step(0xb1e3, 2);
      regs.sec(); m.step(0xb1e4, 2);
      do {
        { const ptr = mem.read16(0x00b6); const ea = (ptr + regs.y) & 0xffff; regs.sbc(mem.read8(ea)); m.step(0xb1e6, (ptr & 0xff00) !== (ea & 0xff00) ? 6 : 5); }
        regs.y = regs.dec8(regs.y); m.step(0xb1e7, 2);
        if (regs.fPl) { m.step(0xb1e4, 3); } else { m.step(0xb1e9, 2); break; }
      } while (true);
      regs.y = regs.a; regs.setNZ(regs.y); m.step(0xb1ea, 2);
      if (regs.fZ) { m.step(0xb1ee, 3); }
      else { m.step(0xb1ec, 2); regs.eor(0xe5); m.step(0xb1ee, 2); }
      if (regs.fZ) { m.step(0xb1f2, 3); }
      else { m.step(0xb1f0, 2); regs.eor(0x29); m.step(0xb1f2, 2); }
      mem.write8(0x0455, regs.a); m.step(0xb1f5, 4);
    }
  }
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xb1f7, 2);
  m.push16(0xb1f9); m.step(0xb1fa, 6); m.call(0xb2fe);
  regs.a = mem.read8(0xcec4); regs.setNZ(regs.a); m.step(0xb1fd, 4);
  mem.write8(0x2000, regs.a); m.step(0xb200, 4);
  regs.a = mem.read8(0xcec5); regs.setNZ(regs.a); m.step(0xb203, 4);
  mem.write8(0x2001, regs.a); m.step(0xb206, 4);
  regs.clv(); m.step(0xb207, 2);
  m.step(0xb20c, 3);
  return m.ret(6);
}
