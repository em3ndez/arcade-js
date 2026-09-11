// SPDX-License-Identifier: GPL-3.0-only
// loc_c6c7  (ROM 0xc6c7-0xc73b) -- per $03ac[$38]: if 0, blank a 4-slot vector list via ($74),y; else set
// up $56-$58, call c453/c098/c73c, then per bit6 of $039a[$38] either emit a $cec8 word or a $3db2 word
// through ($74),y. Advances $a9 (the ($74) write cursor) and rts.
export function loc_c6c7(m) {
  const { regs, mem } = m;
  regs.x = mem.read8(0x38); regs.setNZ(regs.x); m.step(0xc6c9, 3);
  { const ea = (0x03ac + regs.x) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xc6cc, (0x03ac & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
  if (regs.fNZ) { // c6cc bne 0xc6e4 (taken -- $03ac,x != 0)
    m.step(0xc6e4, 3);
    mem.write8(0x57, regs.a); m.step(0xc6e6, 3);
    m.push16(0xc6e8); m.step(0xc6e9, 6); m.call(0xc453);
    { const ea = (0x0435 + regs.x) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xc6ec, (0x0435 & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
    mem.write8(0x56, regs.a); m.step(0xc6ee, 3);
    { const ea = (0x0445 + regs.x) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xc6f1, (0x0445 & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
    mem.write8(0x58, regs.a); m.step(0xc6f3, 3);
    m.push16(0xc6f5); m.step(0xc6f6, 6); m.call(0xc098);
    m.push16(0xc6f8); m.step(0xc6f9, 6); m.call(0xc73c);
    regs.x = mem.read8(0x38); regs.setNZ(regs.x); m.step(0xc6fb, 3);
    { const ea = (0x039a + regs.x) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xc6fe, (0x039a & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
    regs.and(0x40); m.step(0xc700, 2);
    if (regs.fNZ) { // c700 beq 0xc721 (not taken -- bit6 set)
      m.step(0xc702, 2);
      m.push16(0xc704); m.step(0xc705, 6); m.call(0xbd3e);
      regs.a = mem.read8(0x60ca); regs.setNZ(regs.a); m.step(0xc708, 4);
      regs.and(0x02); m.step(0xc70a, 2);
      regs.clc(); m.step(0xc70b, 2);
      regs.adc(0x1c); m.step(0xc70d, 2);
      regs.x = regs.a; regs.setNZ(regs.x); m.step(0xc70e, 2);
      { const ea = (0xcec9 + regs.x) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xc711, (0xcec9 & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
      regs.y = regs.inc8(regs.y); m.step(0xc712, 2);
      mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xc714, 6);
      regs.y = regs.dec8(regs.y); m.step(0xc715, 2);
      { const ea = (0xcec8 + regs.x) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xc718, (0xcec8 & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
      mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xc71a, 6);
      regs.y = regs.inc8(regs.y); m.step(0xc71b, 2);
      regs.y = regs.inc8(regs.y); m.step(0xc71c, 2);
      mem.write8(0xa9, regs.y); m.step(0xc71e, 3);
      regs.clv(); m.step(0xc71f, 2);
      m.step(0xc73b, 3);
      return m.ret(6);
    }
    m.step(0xc721, 3); // c700 beq 0xc721 (taken -- bit6 clear)
    regs.y = mem.read8(0xa9); regs.setNZ(regs.y); m.step(0xc723, 3);
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0xc725, 2);
    mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xc727, 6);
    regs.y = regs.inc8(regs.y); m.step(0xc728, 2);
    regs.a = 0x68; regs.setNZ(regs.a); m.step(0xc72a, 2);
    mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xc72c, 6);
    regs.y = regs.inc8(regs.y); m.step(0xc72d, 2);
    regs.a = mem.read8(0x3db2); regs.setNZ(regs.a); m.step(0xc730, 4);
    mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xc732, 6);
    regs.y = regs.inc8(regs.y); m.step(0xc733, 2);
    regs.a = mem.read8(0x3db3); regs.setNZ(regs.a); m.step(0xc736, 4);
    mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xc738, 6);
    regs.y = regs.inc8(regs.y); m.step(0xc739, 2);
    mem.write8(0xa9, regs.y); m.step(0xc73b, 3);
    return m.ret(6);
  }
  m.step(0xc6ce, 2); // c6cc bne (fall -- $03ac,x == 0)
  regs.y = mem.read8(0xa9); regs.setNZ(regs.y); m.step(0xc6d0, 3);
  regs.x = 0x03; regs.setNZ(regs.x); m.step(0xc6d2, 2);
  do {
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0xc6d4, 2);
    mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xc6d6, 6);
    regs.y = regs.inc8(regs.y); m.step(0xc6d7, 2);
    regs.a = 0x71; regs.setNZ(regs.a); m.step(0xc6d9, 2);
    mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xc6db, 6);
    regs.y = regs.inc8(regs.y); m.step(0xc6dc, 2);
    regs.x = regs.dec8(regs.x); m.step(0xc6dd, 2);
    if (regs.fPl) { m.step(0xc6d2, 3); } else { m.step(0xc6df, 2); break; }
  } while (true);
  mem.write8(0xa9, regs.y); m.step(0xc6e1, 3);
  regs.clv(); m.step(0xc6e2, 2);
  m.step(0xc73b, 3);
  return m.ret(6);
}
