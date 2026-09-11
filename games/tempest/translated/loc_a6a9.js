// SPDX-License-Identifier: GPL-3.0-only
// loc_a6a9 (ROM 0xa6a9-0xa720) -- integrates slot x's 3 motion axes. Per axis it adds a velocity-low byte
// ($02e3/$02c3/$0303,x) into a position-fraction ($0223/$0203/$0243,x, carry kept), then folds that carry
// plus a velocity-whole byte ($0343/$0323/$0363,x, tested for sign) into a whole coord, clamping to the ring
// [$10,$f0): sign>=0 uses cmp #$f0/bcc (>=$f0 -> reset), sign<0 uses cmp #$10/bcs (<$10 -> reset). Axis 0's
// whole lands in Y (tya->$0283,x at the very end); axes 1/2 write $0263,x and $02a3,x and zero Y on overflow.
export function loc_a6a9(m) {
  const { regs, mem } = m;
  // --- axis 0: fraction $0223,x, sign $0343,x, whole -> Y ---
  { const b = 0x02e3, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xa6ac, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  regs.clc(); m.step(0xa6ad, 2);
  { const b = 0x0223, e = (b + regs.x) & 0xffff; regs.adc(mem.read8(e)); m.step(0xa6b0, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  mem.write8((0x0223 + regs.x) & 0xffff, regs.a); m.step(0xa6b3, 5);
  { const b = 0x0343, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xa6b6, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  L_a6cd: {
    if (regs.fN) {
      m.step(0xa6c4, 3); // bmi taken -> a6c4
      { const b = 0x0283, e = (b + regs.x) & 0xffff; regs.adc(mem.read8(e)); m.step(0xa6c7, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
      regs.cmp(0x10); m.step(0xa6c9, 2);
      if (regs.fC) { m.step(0xa6cd, 3); break L_a6cd; } // bcs taken
      m.step(0xa6cb, 2); regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa6cd, 2); break L_a6cd; // lda #0
    }
    m.step(0xa6b8, 2);
    { const b = 0x0283, e = (b + regs.x) & 0xffff; regs.adc(mem.read8(e)); m.step(0xa6bb, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    regs.cmp(0xf0); m.step(0xa6bd, 2);
    if (!regs.fC) { m.step(0xa6c1, 3); } // bcc taken -> a6c1
    else { m.step(0xa6bf, 2); regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa6c1, 2); } // lda #0
    regs.clv(); m.step(0xa6c2, 2);
    m.step(0xa6cd, 3); // bvc uncond -> a6cd
  }
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xa6ce, 2); // tay
  // --- axis 1: fraction $0203,x, sign $0323,x, whole $0263,x ---
  { const b = 0x02c3, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xa6d1, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  regs.clc(); m.step(0xa6d2, 2);
  { const b = 0x0203, e = (b + regs.x) & 0xffff; regs.adc(mem.read8(e)); m.step(0xa6d5, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  mem.write8((0x0203 + regs.x) & 0xffff, regs.a); m.step(0xa6d8, 5);
  { const b = 0x0323, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xa6db, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  L_a6f2: {
    if (regs.fN) {
      m.step(0xa6e9, 3); // bmi taken -> a6e9
      { const b = 0x0263, e = (b + regs.x) & 0xffff; regs.adc(mem.read8(e)); m.step(0xa6ec, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
      regs.cmp(0x10); m.step(0xa6ee, 2);
      if (regs.fC) { m.step(0xa6f2, 3); break L_a6f2; } // bcs taken
      m.step(0xa6f0, 2); regs.y = 0x00; regs.setNZ(regs.y); m.step(0xa6f2, 2); break L_a6f2; // ldy #0
    }
    m.step(0xa6dd, 2);
    { const b = 0x0263, e = (b + regs.x) & 0xffff; regs.adc(mem.read8(e)); m.step(0xa6e0, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    regs.cmp(0xf0); m.step(0xa6e2, 2);
    if (!regs.fC) { m.step(0xa6e6, 3); } // bcc taken -> a6e6
    else { m.step(0xa6e4, 2); regs.y = 0x00; regs.setNZ(regs.y); m.step(0xa6e6, 2); } // ldy #0
    regs.clv(); m.step(0xa6e7, 2);
    m.step(0xa6f2, 3); // bvc uncond -> a6f2
  }
  mem.write8((0x0263 + regs.x) & 0xffff, regs.a); m.step(0xa6f5, 5);
  // --- axis 2: fraction $0243,x, sign $0363,x, whole $02a3,x ---
  { const b = 0x0303, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xa6f8, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  regs.clc(); m.step(0xa6f9, 2);
  { const b = 0x0243, e = (b + regs.x) & 0xffff; regs.adc(mem.read8(e)); m.step(0xa6fc, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  mem.write8((0x0243 + regs.x) & 0xffff, regs.a); m.step(0xa6ff, 5);
  { const b = 0x0363, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xa702, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  L_a719: {
    if (regs.fN) {
      m.step(0xa710, 3); // bmi taken -> a710
      { const b = 0x02a3, e = (b + regs.x) & 0xffff; regs.adc(mem.read8(e)); m.step(0xa713, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
      regs.cmp(0x10); m.step(0xa715, 2);
      if (regs.fC) { m.step(0xa719, 3); break L_a719; } // bcs taken
      m.step(0xa717, 2); regs.y = 0x00; regs.setNZ(regs.y); m.step(0xa719, 2); break L_a719; // ldy #0
    }
    m.step(0xa704, 2);
    { const b = 0x02a3, e = (b + regs.x) & 0xffff; regs.adc(mem.read8(e)); m.step(0xa707, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    regs.cmp(0xf0); m.step(0xa709, 2);
    if (!regs.fC) { m.step(0xa70d, 3); } // bcc taken -> a70d
    else { m.step(0xa70b, 2); regs.y = 0x00; regs.setNZ(regs.y); m.step(0xa70d, 2); } // ldy #0
    regs.clv(); m.step(0xa70e, 2);
    m.step(0xa719, 3); // bvc uncond -> a719
  }
  mem.write8((0x02a3 + regs.x) & 0xffff, regs.a); m.step(0xa71c, 5);
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0xa71d, 2); // tya
  mem.write8((0x0283 + regs.x) & 0xffff, regs.a); m.step(0xa720, 5);
  return m.ret(6); // a720 rts
}
