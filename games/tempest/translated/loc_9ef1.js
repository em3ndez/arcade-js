// SPDX-License-Identifier: GPL-3.0-only
// loc_9ef1 (ROM 0x9ef1-0x9f5e) -- per-slot(x) mover. If $028a,x bit7 is set (bmi) it re-seeks the slot via
// jsr $9c99 then dispatches by the returned A (cmp #$80) and bit6 of $0159 into loc_9f81/loc_9f8a/loc_9f5f.
// Else it advances the 16-bit position $029f,x/$02df,x by the per-frame delta $0164/$0169 and clamps the
// hi byte at floor $0202; then (only when $03ab!=0, further gated by zp $9f vs #$11 and A vs #$20) it sets
// carry. carry set -> jsr loc_9f5f; carry clear -> $0159 sign picks loc_9f81 (N set) or loc_9f8a (N clear).
export function loc_9ef1(m) {
  const { regs, mem } = m;
  regs.y = 0x04; regs.setNZ(regs.y); m.step(0x9ef3, 2); // ldy #0x04
  { const b = 0x028a, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9ef6, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  if (regs.fN) {
    // bmi 0x9f43 taken (page cross, 4 cyc) -> re-seek + dispatch
    m.step(0x9f43, 4);
    L_9f5e_a: {
      m.push16(0x9f45); m.step(0x9f46, 6); m.call(0x9c99);        // jsr 0x9c99
      regs.cmp(0x80); m.step(0x9f48, 2);
      if (!regs.fC) { // bcc 0x9f5b -> jsr loc_9f5f
        m.step(0x9f5b, 3);
        m.push16(0x9f5d); m.step(0x9f5e, 6); m.call(0x9f5f);
        break L_9f5e_a;
      }
      m.step(0x9f4a, 2);
      regs.bit(mem.read8(0x0159)); m.step(0x9f4d, 4);
      L_9f58_a: {
        if (!regs.fV) { // bvc 0x9f55 -> jsr loc_9f8a
          m.step(0x9f55, 3);
          m.push16(0x9f57); m.step(0x9f58, 6); m.call(0x9f8a);
          break L_9f58_a;
        }
        m.step(0x9f4f, 2);
        m.push16(0x9f51); m.step(0x9f52, 6); m.call(0x9f81);      // jsr loc_9f81
        regs.clv(); m.step(0x9f53, 2);
        m.step(0x9f58, 3); // bvc -> 0x9f58
      }
      regs.clv(); m.step(0x9f59, 2); // 0x9f58 clv
      m.step(0x9f5e, 3); // bvc -> 0x9f5e
    }
    return m.ret(6); // 0x9f5e rts
  }
  m.step(0x9ef8, 2); // bmi not taken -> advance position
  L_9f2a: {
    { const b = 0x029f, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9efb, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    regs.clc(); m.step(0x9efc, 2);
    regs.adc(mem.read8(0x0164)); m.step(0x9eff, 4);            // lo += delta $0164
    mem.write8((0x029f + regs.x) & 0xffff, regs.a); m.step(0x9f02, 5);
    { const b = 0x02df, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9f05, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    regs.adc(mem.read8(0x0169)); m.step(0x9f08, 4);            // hi += delta $0169 (+ carry)
    mem.write8((0x02df + regs.x) & 0xffff, regs.a); m.step(0x9f0b, 5);
    regs.cmp(mem.read8(0x0202)); m.step(0x9f0e, 4);            // hi vs floor $0202
    if (regs.fC) { // bcs 0x9f19: hi >= floor, keep it
      m.step(0x9f19, 3);
      regs.y = mem.read8(0x03ab); regs.setNZ(regs.y); m.step(0x9f1c, 4);
      if (regs.fZ) { m.step(0x9f29, 3); return m.ret(6); }     // beq 0x9f29 rts ($03ab == 0)
      m.step(0x9f1e, 2);
      regs.y = mem.read8(0x9f); regs.setNZ(regs.y); m.step(0x9f20, 3); // ldy zp $9f
      regs.cpy(0x11); m.step(0x9f22, 2);
      if (regs.fC) { m.step(0x9f26, 3); }                     // bcs 0x9f26: skip the A vs #$20 test
      else { m.step(0x9f24, 2); regs.cmp(0x20); m.step(0x9f26, 2); }
      regs.clv(); m.step(0x9f27, 2);
      m.step(0x9f2a, 3); break L_9f2a; // bvc -> 0x9f2a
    }
    m.step(0x9f10, 2);
    regs.a = mem.read8(0x0202); regs.setNZ(regs.a); m.step(0x9f13, 4); // clamp hi to floor
    mem.write8((0x02df + regs.x) & 0xffff, regs.a); m.step(0x9f16, 5);
    regs.clv(); m.step(0x9f17, 2);
    m.step(0x9f2a, 3); // bvc -> 0x9f2a (carry clear here)
  }
  L_9f40: {
    if (regs.fC) { // bcs 0x9f3d -> jsr loc_9f5f
      m.step(0x9f3d, 3);
      m.push16(0x9f3f); m.step(0x9f40, 6); m.call(0x9f5f);
      break L_9f40;
    }
    m.step(0x9f2c, 2);
    regs.a = mem.read8(0x0159); regs.setNZ(regs.a); m.step(0x9f2f, 4);
    L_9f3a: {
      if (!regs.fN) { // bpl 0x9f37 -> jsr loc_9f8a
        m.step(0x9f37, 3);
        m.push16(0x9f39); m.step(0x9f3a, 6); m.call(0x9f8a);
        break L_9f3a;
      }
      m.step(0x9f31, 2);
      m.push16(0x9f33); m.step(0x9f34, 6); m.call(0x9f81);      // jsr loc_9f81 ($0159 sign set)
      regs.clv(); m.step(0x9f35, 2);
      m.step(0x9f3a, 3); // bvc -> 0x9f3a
    }
    regs.clv(); m.step(0x9f3b, 2); // 0x9f3a clv
    m.step(0x9f40, 3); // bvc -> 0x9f40
  }
  regs.clv(); m.step(0x9f41, 2); // 0x9f40 clv
  m.step(0x9f5e, 3); // bvc -> 0x9f5e
  return m.ret(6); // 0x9f5e rts
}
