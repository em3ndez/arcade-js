// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_23de  (ROM 0x23DE–0x2403).
 */
export function sub_23de(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;

  regs.a = mem.read8(R(0x0f));
  m.step(0x23e1, 19); // ld a,(ix+0x0f)
  regs.a = regs.dec8(regs.a);
  m.step(0x23e2, 4); // dec a
  if (regs.fNZ) {
    m.step(0x2403, 10); // jp nz,0x2403 -- (ix+0x0F) != 1
    return tail_23de(m, R);
  }
  m.step(0x23e5, 10); // jp nz NOT taken

  regs.xor(regs.a);
  m.step(0x23e6, 4); // xor a
  mem.write8(R(0x07), regs.sla(mem.read8(R(0x07)))); // sla (ix+7); carry=old bit7
  m.step(0x23ea, 23);
  regs.rla();
  m.step(0x23eb, 4); // rla -- carry -> A bit 0
  mem.write8(R(0x08), regs.sla(mem.read8(R(0x08)))); // sla (ix+8)
  m.step(0x23ef, 23);
  regs.rla();
  m.step(0x23f0, 4);
  regs.b = regs.a; // B = the two sign bits
  m.step(0x23f1, 4); // ld b,a
  regs.a = 0x03;
  m.step(0x23f3, 7); // ld a,0x03
  regs.or(regs.c); // A = 0x03 | C (C live-in)
  m.step(0x23f4, 4); // or c
  m.push16(0x23f7);
  m.step(0x3009, 17); // call 0x3009
  m.call(0x3009); // returns A
  regs.rra(); // A bit 0 -> carry
  m.step(0x23f8, 4);
  mem.write8(R(0x08), regs.rr(mem.read8(R(0x08)))); // rr (ix+8); carry in
  m.step(0x23fc, 23);
  regs.rra();
  m.step(0x23fd, 4);
  mem.write8(R(0x07), regs.rr(mem.read8(R(0x07)))); // rr (ix+7)
  m.step(0x2401, 23);
  regs.a = 0x04;
  m.step(0x2403, 7); // ld a,0x04
  return tail_23de(m, R);
}

/**
 * tail_23de  (ROM 0x2403–0x2406) — write A to (ix+0x0F), ret.
 */
export function tail_23de(m, R) {
  const { regs, mem } = m;
  mem.write8(R(0x0f), regs.a);
  m.step(0x2406, 19); // ld (ix+0x0f),a
  m.ret(10);
}
