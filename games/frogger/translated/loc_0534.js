// SPDX-License-Identifier: GPL-3.0-only

// loc_0534  (ROM 0x0534-0x0546) — clear-P1 pre-block: zero (0x825C) and the 0x825E-0x8262 table,
// then jp into the cold-start mid-entry 0x0567.
export function loc_0534(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);
  m.step(0x0535, 4);
  mem.write8(0x825c, regs.a);
  m.step(0x0538, 13); // (0x825c) = 0
  regs.hl = 0x825e;
  m.step(0x053b, 10);
  regs.de = 0x825f;
  m.step(0x053e, 10);
  regs.bc = 0x0004;
  m.step(0x0541, 10);
  mem.write8(regs.hl, regs.b);
  m.step(0x0542, 7); // seed (0x825e) = 0
  m.ldirAt(0x0542, 0x0544); // clear 0x825e-0x8262

  m.step(0x0567, 10); // jp 0x0567
  return m.call(0x0567);
}
