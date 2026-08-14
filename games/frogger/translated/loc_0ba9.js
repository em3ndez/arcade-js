// SPDX-License-Identifier: GPL-3.0-only

// loc_0ba9  (ROM 0x0BA9-0x0BB2) — write one BCD digit to the score tilemap: mask A to a nibble,
// store it at (HL), then step HL up one 32-wide row (L -= 0x20, borrowing into H) for the caller's
// next digit.
export function loc_0ba9(m) {
  const { regs, mem } = m;

  regs.and(0x0f);
  m.step(0x0bab, 7); // keep the low nibble -- one digit

  mem.write8(regs.hl, regs.a);
  m.step(0x0bac, 7);

  regs.a = regs.l;
  m.step(0x0bad, 4);

  regs.sub(0x20);
  m.step(0x0baf, 7); // L - 0x20 -- one tile row up (carry = borrow)

  regs.l = regs.a;
  m.step(0x0bb0, 4);

  if (regs.fNC) {
    m.ret(11); // ret nc -- no borrow, HL still in the row
    return;
  }
  m.step(0x0bb1, 5);

  regs.h = regs.dec8(regs.h);
  m.step(0x0bb2, 4); // borrow -> previous page

  m.ret();
}
