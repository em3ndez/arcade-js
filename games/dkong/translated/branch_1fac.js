// SPDX-License-Identifier: GPL-3.0-only

/**
 * branch_1fac  (ROM 0x1FAC–0x1FE4) — exx; animate -- advance (ix+5); on (ix+17)==(ix+5).
 *  recompute sprite; else step (ix+0f). Both jp 0x21ba.
 */
export function branch_1fac(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  regs.exx(); // swap to shadow BC/DE/HL (IX untouched)
  m.step(0x1fad, 4); // exx
  mem.write8(R(0x05), regs.inc8(mem.read8(R(0x05))));
  m.step(0x1fb0, 23); // inc (ix+0x05)
  regs.a = mem.read8(R(0x17));
  m.step(0x1fb3, 19); // ld a,(ix+0x17)
  regs.cp(mem.read8(R(0x05)));
  m.step(0x1fb6, 19); // cp (ix+0x05)
  if (regs.fNZ) { m.step(0x1fce, 10); return m.call(0x1fce); } // jp nz -- shared tail
  m.step(0x1fb9, 10);
  regs.a = mem.read8(R(0x15));
  m.step(0x1fbc, 19); // ld a,(ix+0x15)
  regs.rlca();
  m.step(0x1fbd, 4); // rlca
  regs.rlca();
  m.step(0x1fbe, 4); // rlca
  regs.add(0x15);
  m.step(0x1fc0, 7); // add a,0x15
  mem.write8(R(0x07), regs.a);
  m.step(0x1fc3, 19); // ld (ix+0x07),a
  regs.a = mem.read8(R(0x02));
  m.step(0x1fc6, 19); // ld a,(ix+0x02)
  regs.xor(0x07);
  m.step(0x1fc8, 7); // xor 0x07
  mem.write8(R(0x02), regs.a);
  m.step(0x1fcb, 19); // ld (ix+0x02),a
  m.step(0x21ba, 10); // jp 0x21ba
  return m.call(0x21ba);
}
