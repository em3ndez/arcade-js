// SPDX-License-Identifier: GPL-3.0-only
// loc_9fc4 (ROM 0x9fc4-0xa027) -- per-slot(x) approach step toward its segment target. Sets $010c=1, then
// seeds $03ac,y=$f1 (y=$02b9,x, the segment) if that column's stored depth is 0. Keeps $03ac,y as the min of
// its old value and $02df,x (the slot's depth), tagging $039a,y=$80 on a new min. If depth < $20 it forces
// bit7 of $028a,x and clamps depth to $20; if depth >= $f2 it picks a new segment (jsr $a028), parks depth
// at $f0, and -- when $03ab==0 -- rewrites $028a,x low2 -> %01 and $0283,x low3 -> %010, clearing $010c.
export function loc_9fc4(m) {
  const { regs, mem } = m;
  L_a027: {
    regs.a = 0x01; regs.setNZ(regs.a); m.step(0x9fc6, 2);
    mem.write8(0x010c, regs.a); m.step(0x9fc9, 4);
    { const b = 0x02b9, e = (b + regs.x) & 0xffff; regs.y = mem.read8(e); regs.setNZ(regs.y); m.step(0x9fcc, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    { const b = 0x03ac, e = (b + regs.y) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9fcf, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    if (regs.fNZ) { m.step(0x9fd6, 3); }                          // bne 9fd6: column already seeded
    else {
      m.step(0x9fd1, 2);
      regs.a = 0xf1; regs.setNZ(regs.a); m.step(0x9fd3, 2);       // seed depth $f1
      mem.write8((0x03ac + regs.y) & 0xffff, regs.a); m.step(0x9fd6, 5);
    }
    // L_9fd6
    { const b = 0x02df, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9fd9, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    { const b = 0x03ac, e = (b + regs.y) & 0xffff; regs.cmp(mem.read8(e)); m.step(0x9fdc, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    if (regs.fC) { m.step(0x9fe6, 3); }                           // bcs 9fe6: not a new min
    else {
      m.step(0x9fde, 2);
      mem.write8((0x03ac + regs.y) & 0xffff, regs.a); m.step(0x9fe1, 5);   // new min depth
      regs.a = 0x80; regs.setNZ(regs.a); m.step(0x9fe3, 2);
      mem.write8((0x039a + regs.y) & 0xffff, regs.a); m.step(0x9fe6, 5);
    }
    // L_9fe6
    { const b = 0x02df, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9fe9, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    regs.cmp(0x20); m.step(0x9feb, 2);
    if (regs.fC) {
      m.step(0x9ffd, 3);                                          // bcs 9ffd: depth >= $20
      regs.cmp(0xf2); m.step(0x9fff, 2);
      if (!regs.fC) { m.step(0xa027, 3); break L_a027; }          // bcc a027: depth < $f2
      m.step(0xa001, 2);
      m.push16(0xa003); m.step(0xa004, 6); m.call(0xa028);        // jsr a028 (pushes a001+2)
      regs.a = 0xf0; regs.setNZ(regs.a); m.step(0xa006, 2);
      mem.write8((0x02df + regs.x) & 0xffff, regs.a); m.step(0xa009, 5);   // park depth $f0
      regs.a = mem.read8(0x03ab); regs.setNZ(regs.a); m.step(0xa00c, 4);
      if (regs.fNZ) { m.step(0xa027, 3); break L_a027; }          // bne a027
      m.step(0xa00e, 2);
      { const b = 0x028a, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xa011, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
      regs.and(0xfc); m.step(0xa013, 2);
      regs.ora(0x01); m.step(0xa015, 2);
      mem.write8((0x028a + regs.x) & 0xffff, regs.a); m.step(0xa018, 5);
      { const b = 0x0283, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xa01b, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
      regs.and(0xf8); m.step(0xa01d, 2);
      regs.ora(0x02); m.step(0xa01f, 2);
      mem.write8((0x0283 + regs.x) & 0xffff, regs.a); m.step(0xa022, 5);
      regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa024, 2);
      mem.write8(0x010c, regs.a); m.step(0xa027, 4);              // -> fall to rts
    } else {
      m.step(0x9fed, 2);                                          // bcs not taken: depth < $20
      { const b = 0x028a, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9ff0, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
      regs.ora(0x80); m.step(0x9ff2, 2);
      mem.write8((0x028a + regs.x) & 0xffff, regs.a); m.step(0x9ff5, 5);
      regs.a = 0x20; regs.setNZ(regs.a); m.step(0x9ff7, 2);
      mem.write8((0x02df + regs.x) & 0xffff, regs.a); m.step(0x9ffa, 5);   // clamp depth $20
      regs.clv(); m.step(0x9ffb, 2);
      m.step(0xa027, 4); break L_a027;                            // bvc a027 (page cross +1)
    }
  }
  return m.ret(6); // a027 rts
}
