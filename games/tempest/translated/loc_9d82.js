// SPDX-License-Identifier: GPL-3.0-only
// loc_9d82 (ROM 0x9d82-0x9e2e) -- advances slot x's animation/turn state. Steps a phase counter in $02cc,x
// (iny/dey by the sign bit6 of $0283,x, masked to a nibble, bit7 forced). Then two paths by ($0283,x & 7):
// ==4 (9da2) a turn is settling -- when the low nibble of $02cc,x hits 0 it rotates $02b9,x, clears $0283,x
// bit7, reseeds $02cc,x=$20, flips $028a,x sign, and (if $03ab==0 and the hi coord $02df,x==$0202) jsr $9f81
// else just isolates $028a,x bit7; !=4 (9dee) it recomputes the target via jsr $9ed7 and, on a match, walks
// $02b9,x toward it (add or subtract by $0283,x bit6). Every exit stashes $0283,x bit7 in $010c, then rts.
export function loc_9d82(m) {
  const { regs, mem } = m;
  L_9e26: {
    { const b = 0x02cc, e = (b + regs.x) & 0xffff; regs.y = mem.read8(e); regs.setNZ(regs.y); m.step(0x9d85, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    { const b = 0x0283, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9d88, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    regs.and(0x40); m.step(0x9d8a, 2);
    if (regs.fNZ) { m.step(0x9d90, 3); regs.y = regs.dec8(regs.y); m.step(0x9d91, 2); }          // bne -> bit6 set: dey
    else { m.step(0x9d8c, 2); regs.y = regs.inc8(regs.y); m.step(0x9d8d, 2); regs.clv(); m.step(0x9d8e, 2); m.step(0x9d91, 3); } // iny; clv; bvc join
    regs.a = regs.y; regs.setNZ(regs.a); m.step(0x9d92, 2); // tya
    regs.and(0x0f); m.step(0x9d94, 2);
    regs.ora(0x80); m.step(0x9d96, 2);
    mem.write8((0x02cc + regs.x) & 0xffff, regs.a); m.step(0x9d99, 5);
    { const b = 0x0283, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9d9c, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    regs.and(0x07); m.step(0x9d9e, 2);
    regs.cmp(0x04); m.step(0x9da0, 2);
    if (regs.fNZ) {
      // bne 9dee taken -> state != 4 path
      m.step(0x9dee, 3);
      L_9e1b: {
        { const b = 0x02b9, e = (b + regs.x) & 0xffff; regs.y = mem.read8(e); regs.setNZ(regs.y); m.step(0x9df1, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
        { const b = 0x0283, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9df4, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
        regs.eor(0x40); m.step(0x9df6, 2);
        m.push16(0x9df8); m.step(0x9df9, 6); m.call(0x9ed7); // jsr 0x9ed7 (pushes jsraddr+2 = 0x9df8)
        { const b = 0x02cc, e = (b + regs.x) & 0xffff; regs.cmp(mem.read8(e)); m.step(0x9dfc, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
        if (regs.fNZ) { m.step(0x9e26, 4); break L_9e26; } // bne taken (page cross) -> 9e26
        m.step(0x9dfe, 2);
        { const b = 0x0283, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9e01, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
        regs.and(0x7f); m.step(0x9e03, 2);
        mem.write8((0x0283 + regs.x) & 0xffff, regs.a); m.step(0x9e06, 5);
        regs.and(0x40); m.step(0x9e08, 2);
        if (regs.fNZ) { m.step(0x9e1b, 3); break L_9e1b; } // bne taken -> add branch
        m.step(0x9e0a, 2);
        { const b = 0x02b9, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9e0d, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
        mem.write8((0x02cc + regs.x) & 0xffff, regs.a); m.step(0x9e10, 5);
        regs.sec(); m.step(0x9e11, 2);
        regs.sbc(0x01); m.step(0x9e13, 2);
        regs.and(0x0f); m.step(0x9e15, 2);
        mem.write8((0x02b9 + regs.x) & 0xffff, regs.a); m.step(0x9e18, 5);
        regs.clv(); m.step(0x9e19, 2);
        m.step(0x9e26, 3); break L_9e26; // bvc -> 9e26
      }
      // L_9e1b: add branch
      { const b = 0x02b9, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9e1e, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
      regs.clc(); m.step(0x9e1f, 2);
      regs.adc(0x01); m.step(0x9e21, 2);
      regs.and(0x0f); m.step(0x9e23, 2);
      mem.write8((0x02cc + regs.x) & 0xffff, regs.a); m.step(0x9e26, 5); // fall to 9e26
    } else {
      // bne not taken -> state == 4 path
      m.step(0x9da2, 2);
      L_9deb: {
        L_9dbb: {
          { const b = 0x02cc, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9da5, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
          regs.and(0x07); m.step(0x9da7, 2);
          if (regs.fNZ) { m.step(0x9deb, 3); break L_9deb; } // bne taken -> 9deb
          m.step(0x9da9, 2);
          { const b = 0x02cc, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9dac, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
          regs.and(0x08); m.step(0x9dae, 2);
          if (regs.fZ) { m.step(0x9dbb, 3); break L_9dbb; } // beq taken -> skip 02b9 bump
          m.step(0x9db0, 2);
          { const b = 0x02b9, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9db3, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
          regs.clc(); m.step(0x9db4, 2);
          regs.adc(0x01); m.step(0x9db6, 2);
          regs.and(0x0f); m.step(0x9db8, 2);
          mem.write8((0x02b9 + regs.x) & 0xffff, regs.a); m.step(0x9dbb, 5);
        }
        // L_9dbb
        { const b = 0x0283, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9dbe, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
        regs.and(0x7f); m.step(0x9dc0, 2);
        mem.write8((0x0283 + regs.x) & 0xffff, regs.a); m.step(0x9dc3, 5);
        regs.a = 0x20; regs.setNZ(regs.a); m.step(0x9dc5, 2);
        mem.write8((0x02cc + regs.x) & 0xffff, regs.a); m.step(0x9dc8, 5);
        { const b = 0x028a, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9dcb, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
        regs.eor(0x80); m.step(0x9dcd, 2);
        mem.write8((0x028a + regs.x) & 0xffff, regs.a); m.step(0x9dd0, 5);
        regs.a = mem.read8(0x03ab); regs.setNZ(regs.a); m.step(0x9dd3, 4);
        if (regs.fNZ) { m.step(0x9deb, 3); break L_9deb; } // bne taken -> 9deb
        m.step(0x9dd5, 2);
        { const b = 0x02df, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9dd8, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
        regs.cmp(mem.read8(0x0202)); m.step(0x9ddb, 4);
        if (regs.fNZ) {
          // bne taken -> 9de3: just isolate $028a,x bit7
          m.step(0x9de3, 3);
          { const b = 0x028a, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9de6, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
          regs.and(0x80); m.step(0x9de8, 2);
          mem.write8((0x028a + regs.x) & 0xffff, regs.a); m.step(0x9deb, 5);
        } else {
          m.step(0x9ddd, 2);
          m.push16(0x9ddf); m.step(0x9de0, 6); m.call(0x9f81); // jsr 0x9f81 (pushes jsraddr+2 = 0x9ddf)
          regs.clv(); m.step(0x9de1, 2);
          m.step(0x9deb, 3); // bvc -> 9deb
        }
      }
      // L_9deb
      regs.clv(); m.step(0x9dec, 2);
      m.step(0x9e26, 4); break L_9e26; // bvc (page cross) -> 9e26
    }
  }
  // L_9e26: epilogue
  { const b = 0x0283, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9e29, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  regs.and(0x80); m.step(0x9e2b, 2);
  mem.write8(0x010c, regs.a); m.step(0x9e2e, 4);
  return m.ret(6); // 9e2e rts
}
