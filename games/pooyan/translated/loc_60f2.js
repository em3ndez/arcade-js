// SPDX-License-Identifier: GPL-3.0-only

// loc_60f2  (ROM 0x60f2-0x60fe) -- shared outer-loop epilogue of the 0x6069 sprite/collision
// scan. Advance the record pointers (IX += 4, HL += 0x18), decrement the count B; while B != 0
// tail-jp back to the loop head 0x6069, else ret. Reached only by tail-jumps (jp z/nz, jr/jp nc)
// from many scan bodies (0x606b, 0x6075, 0x609f, 0x60ad, 0x621b, 0x622a, ...), never called.
export function loc_60f2(m) {
  const { regs, mem } = m;

  regs.de = 0x0004;            m.step(0x60f5, 10);
  regs.addIx(regs.de);         m.step(0x60f7, 15); // dd 19  add ix,de
  regs.e = 0x18;               m.step(0x60f9, 7);
  regs.addHl(regs.de);         m.step(0x60fa, 11);
  regs.b = regs.dec8(regs.b);  m.step(0x60fb, 4);
  if (regs.fNZ) {
    m.step(0x6069, 10);        // 60fb  jp nz,0x6069 taken -- tail to the loop head
    return m.call(0x6069);
  }
  m.step(0x60fe, 10);          // jp nz not taken
  m.ret(10);                   // 60fe  ret
}
