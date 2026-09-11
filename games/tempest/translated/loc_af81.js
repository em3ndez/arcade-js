// SPDX-License-Identifier: GPL-3.0-only
// loc_af81  (ROM 0xaf81-0xb095) -- clamps $7b/$7c against $0200/$0127 (a scroll/window position: the
// afad-afdf branch diamond nudges $7b/$7c one step toward $0200), then draws 5 rows (afe9 loop over
// $37/$3a using tables $b096/$91fe) and a 4-entry trailer (b081 loop over table $b0a3). Many external
// JSRs (render/vector helpers). abs,x/abs,y reads on data-dependent indexes charge base 4 (see notes).
export function loc_af81(m) {
  const { regs, mem } = m;
  m.push16(0xaf83); m.step(0xaf84, 6); m.call(0xca48);
  mem.write8(0x016e, regs.dec8(mem.read8(0x016e))); m.step(0xaf87, 6);
  regs.y = 0x03; regs.setNZ(regs.y); m.step(0xaf89, 2);
  m.push16(0xaf8b); m.step(0xaf8c, 6); m.call(0xb0d1);
  regs.a = 0x01; regs.setNZ(regs.a); m.step(0xaf8e, 2);
  mem.write8(0x72, regs.a); m.step(0xaf90, 3);
  m.push16(0xaf92); m.step(0xaf93, 6); m.call(0xdf6a);
  regs.x = 0x2c; regs.setNZ(regs.x); m.step(0xaf95, 2);
  regs.a = 0x60; regs.setNZ(regs.a); m.step(0xaf97, 2);
  m.push16(0xaf99); m.step(0xaf9a, 6); m.call(0xab17);
  m.push16(0xaf9c); m.step(0xaf9d, 6); m.call(0xaa92);
  regs.x = 0x07; regs.setNZ(regs.x); m.step(0xaf9f, 2);
  mem.write8(0x37, regs.x); m.step(0xafa1, 3);

  // afa1..afab: do { ...; dec $37 } while (bpl) -- iterate table $b09b,y with $37 = 7..0
  do {
    regs.y = mem.read8(0x37); regs.setNZ(regs.y); m.step(0xafa3, 3);
    regs.x = mem.read8((0xb09b + regs.y) & 0xffff); regs.setNZ(regs.x); m.step(0xafa6, 4);
    m.push16(0xafa8); m.step(0xafa9, 6); m.call(0xab14);
    mem.write8(0x37, regs.dec8(mem.read8(0x37))); m.step(0xafab, 5);
    if (regs.fPl) { m.step(0xafa1, 3); } else { m.step(0xafad, 2); break; }
  } while (true);

  // afad..afdf: branch diamond, all paths converge at afe1 (clamp $7b/$7c one step toward $0200)
  regs.a = mem.read8(0x0200); regs.setNZ(regs.a); m.step(0xafb0, 4);
  regs.sec(); m.step(0xafb1, 2);
  regs.sbc(mem.read8(0x7b)); m.step(0xafb3, 3);
  if (regs.fPl) {
    m.step(0xafbc, 3);
    if (regs.fNZ) {
      m.step(0xafcb, 3);
      let reachedAfe1 = false;
      regs.a = mem.read8(0x7c); regs.setNZ(regs.a); m.step(0xafcd, 3);
      regs.cmp(mem.read8(0x0127)); m.step(0xafd0, 4);
      if (regs.fZ) { m.step(0xafd4, 3); }
      else {
        m.step(0xafd2, 2);
        if (regs.fC) { m.step(0xafe1, 3); reachedAfe1 = true; }
        else { m.step(0xafd4, 2); }
      }
      if (!reachedAfe1) {
        regs.sec(); m.step(0xafd5, 2);
        regs.sbc(mem.read8(0x0200)); m.step(0xafd8, 4);
        if (regs.fNZ) { m.step(0xafdb, 3); }
        else { m.step(0xafda, 2); regs.clc(); m.step(0xafdb, 2); }
        if (regs.fC) { m.step(0xafe1, 3); }
        else {
          m.step(0xafdd, 2);
          mem.write8(0x7b, regs.inc8(mem.read8(0x7b))); m.step(0xafdf, 5);
          mem.write8(0x7c, regs.inc8(mem.read8(0x7c))); m.step(0xafe1, 5);
        }
      }
    } else {
      m.step(0xafbe, 2);
      mem.write8(0x7c, regs.dec8(mem.read8(0x7c))); m.step(0xafc0, 5);
      mem.write8(0x7b, regs.dec8(mem.read8(0x7b))); m.step(0xafc2, 5);
      if (regs.fPl) { m.step(0xafc8, 3); }
      else {
        m.step(0xafc4, 2);
        mem.write8(0x7b, regs.inc8(mem.read8(0x7b))); m.step(0xafc6, 5);
        mem.write8(0x7c, regs.inc8(mem.read8(0x7c))); m.step(0xafc8, 5);
      }
      regs.clv(); m.step(0xafc9, 2);
      m.step(0xafe1, 3);
    }
  } else {
    m.step(0xafb5, 2);
    mem.write8(0x7b, regs.dec8(mem.read8(0x7b))); m.step(0xafb7, 5);
    mem.write8(0x7c, regs.dec8(mem.read8(0x7c))); m.step(0xafb9, 5);
    regs.clv(); m.step(0xafba, 2);
    m.step(0xafe1, 3);
  }

  // afe1..afe7: set up the 5-row draw loop
  regs.a = mem.read8(0x7c); regs.setNZ(regs.a); m.step(0xafe3, 3);
  mem.write8(0x3a, regs.a); m.step(0xafe5, 3);
  regs.x = 0x04; regs.setNZ(regs.x); m.step(0xafe7, 2);
  mem.write8(0x37, regs.x); m.step(0xafe9, 3);

  // afe9..b046: do { row body (b00b..b03f skipped when $91fe,x >= 0x63); dec $3a; dec $37 } while (bpl)
  do {
    regs.y = 0x05; regs.setNZ(regs.y); m.step(0xafeb, 2);
    m.push16(0xafed); m.step(0xafee, 6); m.call(0xb0d1);
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0xaff0, 2);
    mem.write8(0x73, regs.a); m.step(0xaff2, 3);
    m.push16(0xaff4); m.step(0xaff5, 6); m.call(0xab0d);
    regs.x = 0xd8; regs.setNZ(regs.x); m.step(0xaff7, 2);
    regs.y = mem.read8(0x37); regs.setNZ(regs.y); m.step(0xaff9, 3);
    regs.a = mem.read8((0xb096 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xaffc, 4);
    regs.clc(); m.step(0xaffd, 2);
    regs.adc(0xf8); m.step(0xafff, 2);
    m.push16(0xb001); m.step(0xb002, 6); m.call(0xdf75);
    regs.x = mem.read8(0x3a); regs.setNZ(regs.x); m.step(0xb004, 3);
    regs.y = mem.read8((0x91fe + regs.x) & 0xffff); regs.setNZ(regs.y); m.step(0xb007, 4);
    regs.cpy(0x63); m.step(0xb009, 2);
    if (regs.fC) {
      m.step(0xb042, 3);
    } else {
      m.step(0xb00b, 2);
      regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xb00c, 2);
      regs.a = regs.y; regs.setNZ(regs.a); m.step(0xb00d, 2);
      m.push16(0xb00f); m.step(0xb010, 6); m.call(0xaf77);
      regs.y = 0x03; regs.setNZ(regs.y); m.step(0xb012, 2);
      m.push16(0xb014); m.step(0xb015, 6); m.call(0xb0d1);
      m.push16(0xb017); m.step(0xb018, 6); m.call(0xab0d);
      regs.x = 0xba; regs.setNZ(regs.x); m.step(0xb01a, 2);
      regs.y = mem.read8(0x37); regs.setNZ(regs.y); m.step(0xb01c, 3);
      regs.a = mem.read8((0xb096 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xb01f, 4);
      regs.clc(); m.step(0xb020, 2);
      regs.adc(0xec); m.step(0xb022, 2);
      m.push16(0xb024); m.step(0xb025, 6); m.call(0xdf75);
      regs.x = mem.read8(0x3a); regs.setNZ(regs.x); m.step(0xb027, 3);
      m.push16(0xb029); m.step(0xb02a, 6); m.call(0xb0c6);
      m.push16(0xb02c); m.step(0xb02d, 6); m.call(0xab0d);
      regs.x = 0xcc; regs.setNZ(regs.x); m.step(0xb02f, 2);
      regs.y = mem.read8(0x37); regs.setNZ(regs.y); m.step(0xb031, 3);
      regs.a = mem.read8((0xb096 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xb034, 4);
      regs.clc(); m.step(0xb035, 2);
      regs.adc(0x00); m.step(0xb037, 2);
      m.push16(0xb039); m.step(0xb03a, 6); m.call(0xdf75);
      regs.x = mem.read8(0x3a); regs.setNZ(regs.x); m.step(0xb03c, 3);
      regs.a = mem.read8((0x91fe + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xb03f, 4);
      m.push16(0xb041); m.step(0xb042, 6); m.call(0xc4e1);
    }
    mem.write8(0x3a, regs.dec8(mem.read8(0x3a))); m.step(0xb044, 5);
    mem.write8(0x37, regs.dec8(mem.read8(0x37))); m.step(0xb046, 5);
    if (regs.fPl) { m.step(0xafe9, 4); } else { m.step(0xb048, 2); break; }
  } while (true);

  // b048..b07f: trailer setup + one more draw
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xb04a, 2);
  mem.write8(0x73, regs.a); m.step(0xb04c, 3);
  m.push16(0xb04e); m.step(0xb04f, 6); m.call(0xab0d);
  regs.x = 0x1c; regs.setNZ(regs.x); m.step(0xb051, 2);
  m.push16(0xb053); m.step(0xb054, 6); m.call(0xab14);
  regs.a = 0x04; regs.setNZ(regs.a); m.step(0xb056, 2);
  regs.y = 0x01; regs.setNZ(regs.y); m.step(0xb058, 2);
  m.push16(0xb05a); m.step(0xb05b, 6); m.call(0xdfb1);
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0xb05d, 2);
  m.push16(0xb05f); m.step(0xb060, 6); m.call(0xb0d1);
  m.push16(0xb062); m.step(0xb063, 6); m.call(0xab0d);
  regs.x = 0xb8; regs.setNZ(regs.x); m.step(0xb065, 2);
  m.push16(0xb067); m.step(0xb068, 6); m.call(0xb0ab);
  regs.sec(); m.step(0xb069, 2);
  regs.sbc(mem.read8(0x7b)); m.step(0xb06b, 3);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xb06c, 2);
  regs.a = mem.read8((0xb096 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xb06f, 4);
  regs.sec(); m.step(0xb070, 2);
  regs.sbc(0x16); m.step(0xb072, 2);
  m.push16(0xb074); m.step(0xb075, 6); m.call(0xdf75);
  regs.a = 0xe0; regs.setNZ(regs.a); m.step(0xb077, 2);
  mem.write8(0x73, regs.a); m.step(0xb079, 3);
  regs.x = 0x00; regs.setNZ(regs.x); m.step(0xb07b, 2);
  mem.write8(0x38, regs.x); m.step(0xb07d, 3);
  regs.y = 0x03; regs.setNZ(regs.y); m.step(0xb07f, 2);
  mem.write8(0x37, regs.y); m.step(0xb081, 3);

  // b081..b093: do { read (x,a) pair from table $b0a3 via $38; draw } while (bpl), $37 = 3..0
  do {
    regs.y = mem.read8(0x38); regs.setNZ(regs.y); m.step(0xb083, 3);
    regs.a = mem.read8((0xb0a3 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xb086, 4);
    regs.x = regs.a; regs.setNZ(regs.x); m.step(0xb087, 2);
    regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xb088, 2);
    regs.a = mem.read8((0xb0a3 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xb08b, 4);
    regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xb08c, 2);
    mem.write8(0x38, regs.y); m.step(0xb08e, 3);
    m.push16(0xb090); m.step(0xb091, 6); m.call(0xdf75);
    mem.write8(0x37, regs.dec8(mem.read8(0x37))); m.step(0xb093, 5);
    if (regs.fPl) { m.step(0xb081, 3); } else { m.step(0xb095, 2); break; }
  } while (true);

  return m.ret(6);
}
