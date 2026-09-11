// SPDX-License-Identifier: GPL-3.0-only
// loc_a463  (ROM 0xa463-0xa503) -- $2e = A (threshold); loop y=10..0 over the $02db table, forms
// |val - $2e|; low y (<4) with delta<$a7 and matching $02b5/$02ad -> jsr a36f; high y compares vs
// $0151,y band then a chain of $02c8/$02b5/$02c0/$02ad/$0202 checks -> jsr a309 or a38e. On loop
// exit, if $02f2,x==0xff clears $02d3,x/$02f2,x and dec $0135; returns.
export function loc_a463(m) {
  const { regs, mem } = m;
  mem.write8(0x2e, regs.a); m.step(0xa465, 3);
  regs.y = 0x0a; regs.setNZ(regs.y); m.step(0xa467, 2);
  while (true) {
    L_dey: {
      L_a491: {
        L_a48e: {
          regs.a = mem.read8((0x02db + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa46a, 4);
          if (regs.fZ) { m.step(0xa4eb, 3); break L_dey; }
          m.step(0xa46c, 2);
          regs.cmp(mem.read8(0x2e)); m.step(0xa46e, 3);
          if (regs.fC) {
            m.step(0xa470, 2);
            regs.sbc(mem.read8(0x2e)); m.step(0xa472, 3);
            regs.clv(); m.step(0xa473, 2);
            m.step(0xa47b, 3);
          } else {
            m.step(0xa475, 3);
            regs.a = mem.read8(0x2e); regs.setNZ(regs.a); m.step(0xa477, 3);
            regs.sec(); m.step(0xa478, 2);
            regs.sbc(mem.read8((0x02db + regs.y) & 0xffff)); m.step(0xa47b, 4);
          }
          regs.cpy(0x04); m.step(0xa47d, 2);
          if (regs.fC) { m.step(0xa491, 3); break L_a491; }
          m.step(0xa47f, 2);
          regs.cmp(mem.read8(0xa7)); m.step(0xa481, 3);
          if (regs.fC) { m.step(0xa48e, 3); break L_a48e; }
          m.step(0xa483, 2);
          regs.a = mem.read8((0x02b5 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa486, 4);
          regs.eor(mem.read8((0x02ad + regs.x) & 0xffff)); m.step(0xa489, 4);
          if (regs.fNZ) { m.step(0xa48e, 3); break L_a48e; }
          m.step(0xa48b, 2);
          m.push16(0xa48d); m.step(0xa48e, 6); m.call(0xa36f);
        }
        regs.clv(); m.step(0xa48f, 2);
        m.step(0xa4eb, 3); break L_dey;
      }
      // a491
      m.push8(regs.a); m.step(0xa492, 3);
      mem.write8(0x38, regs.y); m.step(0xa494, 3);
      regs.a = mem.read8((0x027f + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa497, 4);
      regs.and(0x07); m.step(0xa499, 2);
      regs.y = regs.a; regs.setNZ(regs.y); m.step(0xa49a, 2);
      regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xa49b, 4);
      regs.cmp(mem.read8((0x0151 + regs.y) & 0xffff)); m.step(0xa49e, 4);
      L_a4e9: {
        if (regs.fC) { m.step(0xa4e9, 3); break L_a4e9; }
        m.step(0xa4a0, 2);
        regs.cpy(0x04); m.step(0xa4a2, 2);
        L_a4c1: {
          if (regs.fNZ) { m.step(0xa4c1, 3); break L_a4c1; }
          m.step(0xa4a4, 2);
          L_a4be: {
            regs.y = mem.read8(0x38); regs.setNZ(regs.y); m.step(0xa4a6, 3);
            regs.a = mem.read8((0x02db + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa4a9, 4);
            regs.cmp(mem.read8(0x0202)); m.step(0xa4ac, 4);
            if (regs.fZ) { m.step(0xa4be, 3); break L_a4be; }
            m.step(0xa4ae, 2);
            regs.a = mem.read8((0x02ad + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xa4b1, 4);
            regs.cmp(mem.read8((0x02b5 + regs.y) & 0xffff)); m.step(0xa4b4, 4);
            if (regs.fNZ) { m.step(0xa4be, 3); break L_a4be; }
            m.step(0xa4b6, 2);
            regs.a = mem.read8((0x02c8 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa4b9, 4);
            if (regs.fPl) { m.step(0xa4be, 3); break L_a4be; }
            m.step(0xa4bb, 2);
            m.push16(0xa4bd); m.step(0xa4be, 6); m.call(0xa309);
          }
          // a4be
          regs.clv(); m.step(0xa4bf, 2);
          m.step(0xa4e9, 3); break L_a4e9;
        }
        // a4c1
        L_a4e2: {
          L_a4da: {
            L_a4d2: {
              regs.y = mem.read8(0x38); regs.setNZ(regs.y); m.step(0xa4c3, 3);
              regs.a = mem.read8((0x02c8 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa4c6, 4);
              if (regs.fPl) { m.step(0xa4d2, 3); break L_a4d2; }
              m.step(0xa4c8, 2);
              regs.a = mem.read8((0x02b5 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa4cb, 4);
              regs.cmp(mem.read8((0x02c0 + regs.x) & 0xffff)); m.step(0xa4ce, 4);
              if (regs.fZ) { m.step(0xa4e2, 3); break L_a4e2; }
              m.step(0xa4d0, 2);
              if (regs.fNZ) { m.step(0xa4da, 3); break L_a4da; }
              m.step(0xa4d2, 2);
            }
            // a4d2
            regs.a = mem.read8((0x02db + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa4d5, 4);
            regs.cmp(mem.read8(0x0202)); m.step(0xa4d8, 4);
            if (regs.fZ) { m.step(0xa4e9, 3); break L_a4e9; }
            m.step(0xa4da, 2);
          }
          // a4da
          regs.a = mem.read8((0x02b5 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa4dd, 4);
          regs.cmp(mem.read8((0x02ad + regs.x) & 0xffff)); m.step(0xa4e0, 4);
          if (regs.fNZ) { m.step(0xa4e9, 3); break L_a4e9; }
          m.step(0xa4e2, 2);
        }
        // a4e2
        mem.write8(0x37, regs.x); m.step(0xa4e4, 3);
        m.push16(0xa4e6); m.step(0xa4e7, 6); m.call(0xa38e);
        regs.x = mem.read8(0x37); regs.setNZ(regs.x); m.step(0xa4e9, 3);
      }
      // a4e9
      regs.y = mem.read8(0x38); regs.setNZ(regs.y); m.step(0xa4eb, 3);
    }
    // a4eb
    regs.y = regs.dec8(regs.y); m.step(0xa4ec, 2);
    if (regs.fN) { m.step(0xa4f1, 3); break; }
    m.step(0xa4ee, 2);
    m.step(0xa467, 3);
  }
  // a4f1
  regs.a = mem.read8((0x02f2 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xa4f4, 4);
  regs.cmp(0xff); m.step(0xa4f6, 2);
  if (regs.fNZ) { m.step(0xa503, 3); return m.ret(6); }
  m.step(0xa4f8, 2);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa4fa, 2);
  mem.write8((0x02d3 + regs.x) & 0xffff, regs.a); m.step(0xa4fd, 5);
  mem.write8(0x0135, regs.dec8(mem.read8(0x0135))); m.step(0xa500, 6);
  mem.write8((0x02f2 + regs.x) & 0xffff, regs.a); m.step(0xa503, 5);
  return m.ret(6);
}
