// SPDX-License-Identifier: GPL-3.0-only
// loc_a75d (ROM 0xa75d-0xa787) -- steps one signed 16-bit velocity ($2b:A, whole in Y-arg stored to $2b, low
// in A) by the fixed step $a788 (=$20) toward zero. If the whole byte ($2b) is negative (bit7 via bit/bmi)
// it ADDS $20 (moving up); else it SUBTRACTS $20. On crossing zero (borrow/carry out of the 16-bit result)
// it saturates: inc $29 and force low byte $2a=0. Returns low byte in A and whole byte in Y ($2b or 0).
export function loc_a75d(m) {
  const { regs, mem } = m;
  mem.write8(0x2b, regs.y); m.step(0xa75f, 3); // sty $2b
  regs.bit(mem.read8(0x2b)); m.step(0xa761, 3); // bit $2b
  L_a784: {
    if (regs.fN) {
      m.step(0xa772, 3); // bmi taken -> a772 (negative -> add path)
      regs.clc(); m.step(0xa773, 2);
      regs.adc(mem.read8(0xa788)); m.step(0xa776, 4); // adc step
      mem.write8(0x2a, regs.a); m.step(0xa778, 3);
      regs.a = mem.read8(0x2b); regs.setNZ(regs.a); m.step(0xa77a, 3); // lda $2b (whole)
      regs.adc(0x00); m.step(0xa77c, 2);
      if (!regs.fC) { m.step(0xa784, 3); break L_a784; } // bcc taken -> a784
      m.step(0xa77e, 2);
    } else {
      m.step(0xa763, 2);
      regs.sec(); m.step(0xa764, 2);
      regs.sbc(mem.read8(0xa788)); m.step(0xa767, 4); // sbc step
      mem.write8(0x2a, regs.a); m.step(0xa769, 3);
      regs.a = mem.read8(0x2b); regs.setNZ(regs.a); m.step(0xa76b, 3);
      regs.sbc(0x00); m.step(0xa76d, 2);
      if (!regs.fC) { m.step(0xa77e, 3); } // bcc taken -> a77e (fall to saturate)
      else {
        m.step(0xa76f, 2);
        regs.clv(); m.step(0xa770, 2);
        m.step(0xa784, 3); break L_a784; // bvc -> a784
      }
    }
    // a77e: saturate to zero
    { const v = regs.inc8(mem.read8(0x29)); mem.write8(0x29, v); m.step(0xa780, 5); } // inc $29
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa782, 2); // lda #0
    mem.write8(0x2a, regs.a); m.step(0xa784, 3); // sta $2a
  }
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xa785, 2); // tay
  regs.a = mem.read8(0x2a); regs.setNZ(regs.a); m.step(0xa787, 3); // lda $2a
  return m.ret(6); // a787 rts
}
