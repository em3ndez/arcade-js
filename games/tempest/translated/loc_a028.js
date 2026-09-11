// SPDX-License-Identifier: GPL-3.0-only
// loc_a028 (ROM 0xa028-0xa06e) -- pick a new segment for slot x by scanning the 16-column depth table
// $03ac,y. Starts at column y=(POKEY2 RANDOM $60da & $0f) and walks all 16 (wrapping $00->$0f), keeping in
// $2d the largest depth seen and in $29 the column that had it (a 0 depth reads as $ff). Column $0f is only
// considered while $0111==0. The winner becomes $02b9,x, its successor (col+1 & $0f) $02cc,x, and bit7 of
// $028a,x is cleared. $60da = POKEY2 reg $0a = RANDOM. Scratch $2c is NOT touched here (caller sets it).
export function loc_a028(m) {
  const { regs, mem } = m;
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa02a, 2);
  mem.write8(0x2d, regs.a); m.step(0xa02c, 3);               // best depth := 0
  regs.a = 0x0f; regs.setNZ(regs.a); m.step(0xa02e, 2);
  mem.write8(0x0140, regs.a); m.step(0xa031, 4);             // loop count := 15
  regs.a = mem.read8(0x60da); regs.setNZ(regs.a); m.step(0xa034, 4);
  regs.and(0x0f); m.step(0xa036, 2);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xa037, 2);    // tay: start column
  for (;;) {
    L_a04f: {
      L_a047: {
        L_a040: {
          regs.cpy(0x0f); m.step(0xa039, 2);
          if (regs.fNZ) { m.step(0xa040, 3); break L_a040; } // bne a040: col != $0f
          m.step(0xa03b, 2);
          regs.a = mem.read8(0x0111); regs.setNZ(regs.a); m.step(0xa03e, 4);
          if (regs.fNZ) { m.step(0xa04f, 3); break L_a04f; } // bne a04f: skip col $0f
          m.step(0xa040, 2);
        }
        // L_a040
        { const b = 0x03ac, e = (b + regs.y) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xa043, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
        if (regs.fNZ) { m.step(0xa047, 3); break L_a047; }   // bne a047
        m.step(0xa045, 2);
        regs.a = 0xff; regs.setNZ(regs.a); m.step(0xa047, 2); // depth 0 reads as $ff
      }
      // L_a047
      regs.cmp(mem.read8(0x2d)); m.step(0xa049, 3);
      if (!regs.fC) { m.step(0xa04f, 3); break L_a04f; }     // bcc a04f: not a new best
      m.step(0xa04b, 2);
      mem.write8(0x2d, regs.a); m.step(0xa04d, 3);           // new best depth
      mem.write8(0x29, regs.y); m.step(0xa04f, 3);           // sty 29: winning column
    }
    // L_a04f
    regs.y = regs.dec8(regs.y); m.step(0xa050, 2);           // dey
    if (regs.fN) { m.step(0xa052, 2); regs.y = 0x0f; regs.setNZ(regs.y); m.step(0xa054, 2); } // bpl not taken -> wrap to $0f
    else { m.step(0xa054, 3); }                              // bpl a054
    // L_a054
    { const v = regs.dec8(mem.read8(0x0140)); mem.write8(0x0140, v); m.step(0xa057, 6); }
    if (!regs.fN) { m.step(0xa037, 3); continue; }           // bpl a037: more columns
    m.step(0xa059, 2);
    break;
  }
  regs.a = mem.read8(0x29); regs.setNZ(regs.a); m.step(0xa05b, 3);
  mem.write8((0x02b9 + regs.x) & 0xffff, regs.a); m.step(0xa05e, 5); // segment := winner
  regs.clc(); m.step(0xa05f, 2);
  regs.adc(0x01); m.step(0xa061, 2);
  regs.and(0x0f); m.step(0xa063, 2);
  mem.write8((0x02cc + regs.x) & 0xffff, regs.a); m.step(0xa066, 5); // successor column
  { const b = 0x028a, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xa069, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  regs.and(0x7f); m.step(0xa06b, 2);
  mem.write8((0x028a + regs.x) & 0xffff, regs.a); m.step(0xa06e, 5);
  return m.ret(6); // a06e rts
}
