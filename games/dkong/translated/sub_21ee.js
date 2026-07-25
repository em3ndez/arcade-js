// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_21ee  (ROM 0x21EE–0x2206).
 */
export function sub_21ee(m) {
  const { regs, mem } = m;

  regs.de = 0x21d1;
  m.step(0x21f1, 10); // ld de,0x21d1
  regs.hl = 0x63cc;
  m.step(0x21f4, 10); // ld hl,0x63cc

  regs.a = mem.read8(regs.hl); // A = script index
  m.step(0x21f5, 7); // ld a,(hl)
  regs.rlca(); // rotate (bit 7 wraps into bit 0)
  m.step(0x21f6, 4);
  regs.add(regs.e); // 8-bit add -- no carry into D
  m.step(0x21f7, 4);
  regs.e = regs.a;
  m.step(0x21f8, 4); // ld e,a

  regs.a = mem.read8(regs.de); // the input byte for this script step
  m.step(0x21f9, 7); // ld a,(de)
  mem.write8(0x6010, regs.a); // overwrite the decoded player input
  m.step(0x21fc, 13);

  regs.l = regs.inc8(regs.l); // inc l -- HL 0x63CC -> 0x63CD
  m.step(0x21fd, 4);
  regs.a = mem.read8(regs.hl); // READ BEFORE the RMW: PRE-decrement value
  m.step(0x21fe, 7);
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl))); // dec (hl) -- 0xFF when it was 0
  m.step(0x21ff, 11);
  regs.and(regs.a); // tests the PRE-decrement value
  m.step(0x2200, 4);
  if (regs.fNZ) {
    m.ret(11); // ret nz -- still counting down this step
    return;
  }
  m.step(0x2201, 5); // ret nz NOT taken -- falls through

  regs.e = regs.inc8(regs.e); // inc e -- no carry into D
  m.step(0x2202, 4);
  regs.a = mem.read8(regs.de); // the duration byte of this pair
  m.step(0x2203, 7);
  mem.write8(regs.hl, regs.a); // reload 0x63CD (overwriting the 0xFF)
  m.step(0x2204, 7);
  regs.l = regs.dec8(regs.l); // dec l -- HL 0x63CD -> 0x63CC
  m.step(0x2205, 4);
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl))); // advance the script index
  m.step(0x2206, 11);
  m.ret(10); // ret (0x2206)
}
