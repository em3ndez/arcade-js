// SPDX-License-Identifier: GPL-3.0-only

// loc_0b95  (ROM 0x0B95-0x0B9A) — draw a 4-digit BCD field (DE) at HL via loc_0b9b, then write a
// leading 0 (xor a) at the field's top cell via loc_0ba9.
export function loc_0b95(m) {
  const { regs } = m;

  m.push16(0x0b98);
  m.step(0x0b9b, 17); // call 0x0b9b -- the four BCD digits
  m.call(0x0b9b);

  regs.xor(regs.a);
  m.step(0x0b99, 4); // A = 0 -- the leading digit

  m.step(0x0ba9, 12); // jr 0x0ba9
  return m.call(0x0ba9);
}
