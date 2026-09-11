// SPDX-License-Identifier: GPL-3.0-only
// loc_9d06 (ROM 0x9d06-0x9d66) -- per-slot(x) step: stashes $0202 into $02df,x, then branches on
// ($0283,x & 7). ==1 & $03ab!=0: toggle bit7 of $028a,x + rts. Slot negative: inc $02df,x + rts.
// Else dec $0108; if $0109!=1 jsr $9d67; else scan slots y=6..0 for one whose $02df,y matches $0202
// (skipping self via cpx $38 / zero entries) and copy its ($0283,y & 0x40)^0x40 into $0283,x. Tail
// (9d5e): $010b=0x41, inc $0109, rts. abs,x/abs,y loads model the +1 page-cross.
export function loc_9d06(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x0202); regs.setNZ(regs.a); m.step(0x9d09, 4);
  mem.write8((0x02df + regs.x) & 0xffff, regs.a); m.step(0x9d0c, 5);
  { const p = 0x0283, e = (p + regs.x) & 0xffff;
    regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9d0f, 4 + ((p & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  regs.and(0x07); m.step(0x9d11, 2);
  regs.cmp(0x01); m.step(0x9d13, 2);
  if (regs.fNZ) {
    m.step(0x9d23, 3); // bne -> 9d23
  } else {
    m.step(0x9d15, 2);
    regs.a = mem.read8(0x03ab); regs.setNZ(regs.a); m.step(0x9d18, 4);
    if (regs.fZ) {
      m.step(0x9d23, 3); // beq -> 9d23
    } else {
      m.step(0x9d1a, 2);
      { const p = 0x028a, e = (p + regs.x) & 0xffff;
        regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9d1d, 4 + ((p & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
      regs.eor(0x80); m.step(0x9d1f, 2);
      mem.write8((0x028a + regs.x) & 0xffff, regs.a); m.step(0x9d22, 5);
      return m.ret(6);
    }
  }

  // 9d23
  { const p = 0x0283, e = (p + regs.x) & 0xffff;
    regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9d26, 4 + ((p & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  if (regs.fN === false) {
    m.step(0x9d2c, 3); // bpl -> 9d2c
  } else {
    m.step(0x9d28, 2);
    { const e = (0x02df + regs.x) & 0xffff, v = (mem.read8(e) + 1) & 0xff;
      mem.write8(e, v); regs.setNZ(v); m.step(0x9d2b, 7); }
    return m.ret(6);
  }

  // 9d2c
  { const v = (mem.read8(0x0108) - 1) & 0xff; mem.write8(0x0108, v); regs.setNZ(v); m.step(0x9d2f, 6); }
  regs.a = mem.read8(0x0109); regs.setNZ(regs.a); m.step(0x9d32, 4);
  regs.cmp(0x01); m.step(0x9d34, 2);
  if (regs.fZ) {
    m.step(0x9d3c, 3); // beq -> 9d3c scan
    regs.y = 0x06; regs.setNZ(regs.y); m.step(0x9d3e, 2);
    L_9d54: {
      while (true) {
        // 9d3e loop top
        L_9d51: {
          { const p = 0x02df, e = (p + regs.y) & 0xffff;
            regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9d41, 4 + ((p & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
          if (regs.fZ) { m.step(0x9d51, 3); break L_9d51; } // empty slot -> dey
          m.step(0x9d43, 2);
          mem.write8(0x38, regs.y); m.step(0x9d45, 3);
          regs.cpx(mem.read8(0x38)); m.step(0x9d47, 3);
          if (regs.fZ) { m.step(0x9d51, 3); break L_9d51; } // self (x==y) -> dey
          m.step(0x9d49, 2);
          { const p = 0x02df, e = (p + regs.y) & 0xffff;
            regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9d4c, 4 + ((p & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
          regs.cmp(mem.read8(0x0202)); m.step(0x9d4f, 4);
          if (regs.fZ) { m.step(0x9d54, 3); break L_9d54; } // match found
          m.step(0x9d51, 2);
        }
        // 9d51: dey; bpl 9d3e
        regs.y = regs.dec8(regs.y); m.step(0x9d52, 2);
        if (regs.fN === false) { m.step(0x9d3e, 3); continue; }
        m.step(0x9d54, 2); break;
      }
    }
    // 9d54
    { const p = 0x0283, e = (p + regs.y) & 0xffff;
      regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9d57, 4 + ((p & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    regs.and(0x40); m.step(0x9d59, 2);
    regs.eor(0x40); m.step(0x9d5b, 2);
    mem.write8((0x0283 + regs.x) & 0xffff, regs.a); m.step(0x9d5e, 5);
  } else {
    m.step(0x9d36, 2);
    m.push16(0x9d38); m.step(0x9d39, 6); m.call(0x9d67); // jsr $9d67
    regs.clv(); m.step(0x9d3a, 2);
    m.step(0x9d5e, 3); // clv;bvc -> unconditional 9d5e
  }

  // 9d5e tail
  regs.a = 0x41; regs.setNZ(regs.a); m.step(0x9d60, 2);
  mem.write8(0x010b, regs.a); m.step(0x9d63, 4);
  { const v = (mem.read8(0x0109) + 1) & 0xff; mem.write8(0x0109, v); regs.setNZ(v); m.step(0x9d66, 6); }
  return m.ret(6);
}
