// SPDX-License-Identifier: GPL-3.0-only
// loc_9c58 (ROM 0x9c58-0x9cb5) -- steps slot x's 16-bit tube coordinate ($029f,x lo / $02df,x hi) by a
// per-segment delta from the $0160/$0165,y table (y = $0283,x & 7). Direction is the sign of $028a,x:
// N clear -> add path (9c63), N set -> subtract path (9c99). Add path: on the hi byte reaching $0202 it
// jsr $9d06 (equal/over) else if hi >= $20 and ($028a,x & 3) it jsr $a06f. Sub path floors hi to $f2 on
// underflow past $f0. Dispatch entries: 0x9c58 (full: pick direction), 0x9c63 (add only), 0x9c99 (sub only).
export function loc_9c58(m) {
  const { regs, mem } = m;
  { const b = 0x0283, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9c5b, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  regs.and(0x07); m.step(0x9c5d, 2);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0x9c5e, 2); // tay
  { const b = 0x028a, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9c61, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  if (regs.fN) { m.step(0x9c99, 3); return loc_9c99(m); } // bmi -> subtract path
  m.step(0x9c63, 2); return loc_9c63(m);                  // fall -> add path
}

export function loc_9c63(m) {
  const { regs, mem } = m;
  L_rts: {
    L_9c96: {
      L_9c83: {
        { const b = 0x029f, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9c66, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
        regs.clc(); m.step(0x9c67, 2);
        { const b = 0x0160, e = (b + regs.y) & 0xffff; regs.adc(mem.read8(e)); m.step(0x9c6a, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
        mem.write8((0x029f + regs.x) & 0xffff, regs.a); m.step(0x9c6d, 5);
        { const b = 0x02df, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9c70, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
        { const b = 0x0165, e = (b + regs.y) & 0xffff; regs.adc(mem.read8(e)); m.step(0x9c73, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
        mem.write8((0x02df + regs.x) & 0xffff, regs.a); m.step(0x9c76, 5);
        regs.cmp(mem.read8(0x0202)); m.step(0x9c79, 4);
        if (regs.fZ) { m.step(0x9c7d, 3); }             // beq taken -> jsr $9d06 block
        else {
          m.step(0x9c7b, 2);
          if (regs.fC) { m.step(0x9c83, 3); break L_9c83; } // bcs taken -> $20 check
          m.step(0x9c7d, 2);                            // bcs not taken -> fall to jsr block
        }
        m.push16(0x9c7f); m.step(0x9c80, 6); m.call(0x9d06); // jsr $9d06 (pushes addr+2)
        regs.clv(); m.step(0x9c81, 2);
        m.step(0x9c96, 3); break L_9c96;                // clv; bvc -> 9c96
      }
      // L_9c83
      regs.cmp(0x20); m.step(0x9c85, 2);
      if (regs.fC) { m.step(0x9c96, 3); break L_9c96; } // bcs taken -> 9c96
      m.step(0x9c87, 2);
      { const b = 0x028a, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9c8a, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
      regs.and(0x03); m.step(0x9c8c, 2);
      if (regs.fZ) { m.step(0x9c96, 3); break L_9c96; } // beq taken -> 9c96
      m.step(0x9c8e, 2);
      regs.a = regs.x; regs.setNZ(regs.a); m.step(0x9c8f, 2); // txa
      m.push8(regs.a); m.step(0x9c90, 3);              // pha
      regs.y = regs.a; regs.setNZ(regs.y); m.step(0x9c91, 2); // tay
      m.push16(0x9c93); m.step(0x9c94, 6); m.call(0xa06f);    // jsr $a06f (pushes addr+2)
      regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0x9c95, 4); // pla
      regs.x = regs.a; regs.setNZ(regs.x); m.step(0x9c96, 2);    // tax; fall to 9c96
    }
    // L_9c96
    regs.clv(); m.step(0x9c97, 2);
    m.step(0x9cb5, 3); break L_rts;                    // clv; bvc -> rts
  }
  return m.ret(6);                                     // 9cb5 rts
}

export function loc_9c99(m) {
  const { regs, mem } = m;
  L_rts: {
    { const b = 0x029f, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9c9c, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    regs.sec(); m.step(0x9c9d, 2);
    { const b = 0x0160, e = (b + regs.y) & 0xffff; regs.sbc(mem.read8(e)); m.step(0x9ca0, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    mem.write8((0x029f + regs.x) & 0xffff, regs.a); m.step(0x9ca3, 5);
    { const b = 0x02df, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9ca6, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    { const b = 0x0165, e = (b + regs.y) & 0xffff; regs.sbc(mem.read8(e)); m.step(0x9ca9, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    mem.write8((0x02df + regs.x) & 0xffff, regs.a); m.step(0x9cac, 5);
    regs.cmp(0xf0); m.step(0x9cae, 2);
    if (regs.fNC) { m.step(0x9cb5, 3); break L_rts; }  // bcc taken -> rts (no floor)
    m.step(0x9cb0, 2);
    regs.a = 0xf2; regs.setNZ(regs.a); m.step(0x9cb2, 2);
    mem.write8((0x02df + regs.x) & 0xffff, regs.a); m.step(0x9cb5, 5); // floor hi to $f2
  }
  return m.ret(6);                                     // 9cb5 rts
}
