// SPDX-License-Identifier: GPL-3.0-only
// loc_b102 (ROM 0xb102-0xb130) -- seeds A=0x34,X=0xaa and calls loc_b15a, then clamps the paired
// cursors $014e/$014d: if $014e < 0xa0 wrap it by +0x14; return when the result < 0x50; else step
// $014d by +8, return when $014d < $014e, otherwise pin $014d=0xa0 and store $01=0x14. rts.
export function loc_b102(m) {
  const { regs, mem } = m;
  regs.a = 0x34; regs.setNZ(regs.a); m.step(0xb104, 2);
  regs.x = 0xaa; regs.setNZ(regs.x); m.step(0xb106, 2);
  m.push16(0xb108); m.step(0xb109, 6); m.call(0xb15a); // jsr 0xb15a (sibling; pushes jsraddr+2 = 0xb108)
  L_b130: {
    regs.a = mem.read8(0x014e); regs.setNZ(regs.a); m.step(0xb10c, 4);
    regs.cmp(0xa0); m.step(0xb10e, 2);
    if (regs.fC) { m.step(0xb115, 3); }                  // bcs 0xb115 taken ($014e >= 0xa0): skip wrap
    else {
      m.step(0xb110, 2);
      regs.adc(0x14); m.step(0xb112, 2);                 // carry clear from the cmp above
      mem.write8(0x014e, regs.a); m.step(0xb115, 4);
    }
    regs.cmp(0x50); m.step(0xb117, 2);
    if (!regs.fC) { m.step(0xb130, 3); break L_b130; }   // bcc 0xb130 taken (A < 0x50)
    m.step(0xb119, 2);
    regs.a = mem.read8(0x014d); regs.setNZ(regs.a); m.step(0xb11c, 4);
    regs.clc(); m.step(0xb11d, 2);
    regs.adc(0x08); m.step(0xb11f, 2);
    mem.write8(0x014d, regs.a); m.step(0xb122, 4);
    regs.cmp(mem.read8(0x014e)); m.step(0xb125, 4);
    if (!regs.fC) { m.step(0xb130, 3); break L_b130; }   // bcc 0xb130 taken ($014d < $014e)
    m.step(0xb127, 2);
    regs.a = 0xa0; regs.setNZ(regs.a); m.step(0xb129, 2);
    mem.write8(0x014d, regs.a); m.step(0xb12c, 4);
    regs.a = 0x14; regs.setNZ(regs.a); m.step(0xb12e, 2);
    mem.write8(0x01, regs.a); m.step(0xb130, 3);         // sta 0x01 (zp store = 3)
  }
  return m.ret(6); // 0xb130 rts
}
